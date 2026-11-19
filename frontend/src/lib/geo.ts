import { useEffect, useState } from 'react';

export interface GeoShape {
    id: string;
    d: string;
    centroid: [number, number];
    bbox: [number, number, number, number];
}

export interface GeoRegion extends GeoShape {
    name: Record<'uz' | 'uz-Cyrl' | 'ru' | 'en', string>;
    shortName: Record<'uz' | 'uz-Cyrl' | 'ru' | 'en', string>;
}

export interface GeoDistrict extends GeoShape {
    regionId: string;
    name: string;
}

export interface UzbekistanGeo {
    viewBox: [number, number, number, number];
    regions: GeoRegion[];
    districts: GeoDistrict[];
}

let cache: Promise<UzbekistanGeo> | null = null;

function loadGeo(): Promise<UzbekistanGeo> {
    cache ??= fetch(`${import.meta.env.BASE_URL}geo/uzbekistan.json`).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<UzbekistanGeo>;
    });
    cache.catch(() => {
        cache = null;
    });
    return cache;
}

/** Xarita fayli (90 KB, bir marta yuklanadi va keshda qoladi). */
export function useUzbekistanGeo() {
    const [state, setState] = useState<{ geo: UzbekistanGeo | null; error: boolean }>({ geo: null, error: false });

    useEffect(() => {
        let active = true;
        loadGeo()
            .then((geo) => active && setState({ geo, error: false }))
            .catch(() => active && setState({ geo: null, error: true }));
        return () => {
            active = false;
        };
    }, []);

    return state;
}

const CITY = /\b(shahri|shahar|city|gorod|г\.)\b/;
const NOISE = /\b(viloyati|viloyat|tumani|tuman|shahri|shahar|respublikasi|respublika|republic|of|region|district|city|oblast|rayon)\b/g;

/**
 * Talaffuz kaliti: o‘zbekcha lotin («Chilonzor tumani») va inglizcha
 * transliteratsiya («Chilanzar») bir xil kalitga yaqinlashadi.
 */
export function placeKey(name: string): string {
    const lower = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const city = CITY.test(lower);
    const key = lower
        .replace(/[‘’ʻʼ`'"]/g, '')
        .replace(NOISE, ' ')
        .replace(/kh|x/g, 'h')
        .replace(/q/g, 'k')
        .replace(/dzh|dj/g, 'j')
        .replace(/yo/g, 'o')
        .replace(/yu/g, 'u')
        .replace(/ya/g, 'a')
        .replace(/ye/g, 'e')
        .replace(/o/g, 'a')
        .replace(/[^a-z]/g, '')
        .replace(/(.)\1+/g, '$1');
    return `${key}${city ? '#city' : ''}`;
}

function levenshtein(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
}

export function similarity(a: string, b: string): number {
    if (a === b) return 1;
    const [ka, kb] = [a.replace('#city', ''), b.replace('#city', '')];
    // Shahar va tuman bir-biriga aralashmasin (Farg‘ona shahri ≠ Farg‘ona tumani).
    if (a.endsWith('#city') !== b.endsWith('#city')) return 0;
    const longest = Math.max(ka.length, kb.length);
    return longest === 0 ? 0 : 1 - levenshtein(ka, kb) / longest;
}

/**
 * Bazadagi hududlarni xarita shakllariga bog‘laydi: avval qo‘lda belgilangan
 * geoKey, keyin nom bo‘yicha eng yaqin (o‘xshashlik ≥ 0.72, takrorsiz).
 */
export function matchUnits<T extends { id: number; name: string; geoKey: string | null }>(
    units: T[],
    shapes: { id: string; names: string[] }[],
): Map<number, string> {
    const result = new Map<number, string>();
    const used = new Set<string>();

    for (const unit of units) {
        if (unit.geoKey && shapes.some((shape) => shape.id === unit.geoKey)) {
            result.set(unit.id, unit.geoKey);
            used.add(unit.geoKey);
        }
    }

    const candidates: { unitId: number; shapeId: string; score: number }[] = [];
    for (const unit of units) {
        if (result.has(unit.id)) continue;
        const key = placeKey(unit.name);
        for (const shape of shapes) {
            if (used.has(shape.id)) continue;
            const score = Math.max(...shape.names.map((name) => similarity(key, placeKey(name))));
            if (score >= 0.72) candidates.push({ unitId: unit.id, shapeId: shape.id, score });
        }
    }

    // Eng ishonchli juftliklar birinchi.
    for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
        if (result.has(candidate.unitId) || used.has(candidate.shapeId)) continue;
        result.set(candidate.unitId, candidate.shapeId);
        used.add(candidate.shapeId);
    }

    return result;
}
