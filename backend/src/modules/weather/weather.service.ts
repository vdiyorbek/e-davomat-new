import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { DataSource } from 'typeorm';

export interface WeatherNow {
  temperature: number;
  feelsLike: number | null;
  code: number;
  isDay: boolean;
  windMs: number | null;
  humidity: number | null;
  observedAt: string;
}

interface Scope {
  regionId?: number;
  districtId?: number;
  schoolId?: number;
}

type Row = Record<string, unknown>;
type Point = { lat: number; lon: number };

function toPoint(lat: unknown, lon: unknown): Point | null {
  if (lat === null || lon === null || lat === undefined || lon === undefined) {
    return null;
  }
  const a = Number(lat);
  const b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lon: b } : null;
}

/** Viloyat markazlari (nomning lotin yozuvidagi kalit so‘zi bo‘yicha). */
const REGION_CENTERS: [string, Point][] = [
  ['andijon', { lat: 40.7821, lon: 72.3442 }],
  ['buxoro', { lat: 39.7747, lon: 64.4286 }],
  ['fargona', { lat: 40.3834, lon: 71.7843 }],
  ['jizzax', { lat: 40.1158, lon: 67.8422 }],
  ['xorazm', { lat: 41.55, lon: 60.6333 }],
  ['namangan', { lat: 40.9983, lon: 71.6726 }],
  ['navoiy', { lat: 40.0844, lon: 65.3792 }],
  ['qashqadaryo', { lat: 38.8606, lon: 65.7891 }],
  ['qoraqalpog', { lat: 42.4531, lon: 59.6103 }],
  ['samarqand', { lat: 39.6542, lon: 66.9597 }],
  ['sirdaryo', { lat: 40.4897, lon: 68.7842 }],
  ['surxondaryo', { lat: 37.2242, lon: 67.2783 }],
];
const TASHKENT_REGION: Point = { lat: 41.0333, lon: 69.35 };

function regionCenter(name: string): Point | null {
  const n = name.toLowerCase().replace(/[‘’ʻʼ`'´]/g, '');
  if (n.includes('toshkent')) {
    return /shahr|city|\bsh\b/.test(n) ? FALLBACK : TASHKENT_REGION;
  }
  return REGION_CENTERS.find(([key]) => n.includes(key))?.[1] ?? null;
}

const DEFAULT_URL = 'https://api.open-meteo.com/v1/forecast';
/** Toshkent. */
const FALLBACK = { lat: 41.3111, lon: 69.2797 };
const FRESH_MS = 30 * 60_000;
const STALE_MS = 3 * 3600_000;

/**
 * Joriy ob-havo (Open-Meteo, kalit talab qilmaydi). Joy: maktab → tuman → viloyat
 * maktablarining o‘rtacha koordinatasi; berilmasa — Toshkent. Natija 30 daqiqa keshlanadi,
 * tashqi xizmat ishlamasa 3 soatgacha eski qiymat qaytariladi.
 * Faqat koordinata yuboriladi; foydalanuvchi ma’lumoti tashqariga chiqmaydi.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, { at: number; value: WeatherNow }>();
  private readonly pending = new Map<string, Promise<WeatherNow>>();

  constructor(private readonly dataSource: DataSource) {}

  async current(scope: Scope): Promise<WeatherNow> {
    const { lat, lon } = await this.locate(scope);
    // ~11 km aniqlik: yaqin hududlar bitta so‘rovni baham ko‘radi.
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < FRESH_MS) return cached.value;

    let request = this.pending.get(key);
    if (!request) {
      request = this.fetch(lat, lon).finally(() => this.pending.delete(key));
      this.pending.set(key, request);
    }
    try {
      const value = await request;
      this.cache.set(key, { at: Date.now(), value });
      if (this.cache.size > 200) {
        for (const [k, entry] of this.cache) {
          if (Date.now() - entry.at > STALE_MS) this.cache.delete(k);
        }
      }
      return value;
    } catch (error) {
      this.logger.warn(`Ob-havo olinmadi: ${(error as Error).message}`);
      if (cached && Date.now() - cached.at < STALE_MS) return cached.value;
      throw new ServiceUnavailableException(
        'Ob-havo ma’lumoti hozir mavjud emas',
      );
    }
  }

  /**
   * Ob-havo joyi: tanlangan maktab → tuman → viloyat. Viloyat — viloyat markazi
   * (aniq jadval), tuman/maktab — o‘z koordinatasi, lekin viloyat markazidan haddan
   * tashqari uzoq bo‘lsa (noto‘g‘ri kiritilgan koordinata) viloyat markazi olinadi.
   * Hech narsa tanlanmagan bo‘lsa — Toshkent.
   */
  private async locate(scope: Scope): Promise<{ lat: number; lon: number }> {
    if (!scope.schoolId && !scope.districtId && !scope.regionId)
      return FALLBACK;

    let regionName: string | null = null;
    let own: { lat: number; lon: number } | null = null;

    if (scope.schoolId) {
      const [row]: Row[] = await this.dataSource.query(
        `SELECT s.latitude AS lat, s.longitude AS lon, r.name AS regionName
           FROM schools s JOIN districts d ON d.id = s.districtId
           JOIN regions r ON r.id = d.regionId WHERE s.id = ?`,
        [scope.schoolId],
      );
      regionName = typeof row?.regionName === 'string' ? row.regionName : null;
      own = toPoint(row?.lat, row?.lon);
    } else if (scope.districtId) {
      const [row]: Row[] = await this.dataSource.query(
        `SELECT AVG(s.latitude) AS lat, AVG(s.longitude) AS lon, MIN(r.name) AS regionName
           FROM districts d JOIN regions r ON r.id = d.regionId
           LEFT JOIN schools s ON s.districtId = d.id
                               AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
          WHERE d.id = ?`,
        [scope.districtId],
      );
      regionName = typeof row?.regionName === 'string' ? row.regionName : null;
      own = toPoint(row?.lat, row?.lon);
    } else {
      const [row]: Row[] = await this.dataSource.query(
        'SELECT name AS regionName FROM regions WHERE id = ?',
        [scope.regionId],
      );
      regionName = typeof row?.regionName === 'string' ? row.regionName : null;
    }

    const center = regionName ? regionCenter(regionName) : null;
    if (own && center) {
      const far =
        Math.abs(own.lat - center.lat) > 4 ||
        Math.abs(own.lon - center.lon) > 6;
      return far ? center : own;
    }
    return own ?? center ?? FALLBACK;
  }

  private async fetch(lat: number, lon: number): Promise<WeatherNow> {
    const base = process.env.WEATHER_API_URL || DEFAULT_URL;
    const { data } = await axios.get<unknown>(base, {
      timeout: 6000,
      maxContentLength: 64 * 1024,
      params: {
        latitude: lat.toFixed(3),
        longitude: lon.toFixed(3),
        current:
          'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
        wind_speed_unit: 'ms',
        timezone: 'Asia/Tashkent',
      },
    });
    const current =
      typeof data === 'object' && data !== null
        ? (data as { current?: Record<string, unknown> }).current
        : undefined;
    const temperature = Number(current?.temperature_2m);
    const code = Number(current?.weather_code);
    if (!current || !Number.isFinite(temperature) || !Number.isFinite(code)) {
      throw new Error('Ob-havo javobi noto‘g‘ri');
    }
    const num = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    return {
      temperature: Math.round(temperature),
      feelsLike:
        num(current.apparent_temperature) === null
          ? null
          : Math.round(Number(current.apparent_temperature)),
      code,
      isDay: current.is_day !== 0,
      windMs:
        num(current.wind_speed_10m) === null
          ? null
          : Math.round(Number(current.wind_speed_10m) * 10) / 10,
      humidity: num(current.relative_humidity_2m),
      observedAt: new Date().toISOString(),
    };
  }
}
