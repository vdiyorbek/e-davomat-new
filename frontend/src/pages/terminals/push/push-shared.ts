import type { TFunction } from 'i18next';

export type Source = 'PUSH' | 'AUTO_PULL' | 'MANUAL_PULL';
export type TerminalStatus = 'REALTIME' | 'LAGGING' | 'IDLE' | 'NEVER';

export interface ActivityRow {
    terminalId: number;
    terminalName: string | null;
    schoolName: string | null;
    source: Source;
    hourStart: string;
    received: number;
    inserted: number;
    duplicates: number;
    withPicture: number;
    withoutPicture: number;
    maxLagSeconds: number;
    runs: number;
}

export interface ActivityResponse {
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
    items: ActivityRow[];
}

export interface AttentionTerminal {
    id: number;
    name: string;
    schoolName: string | null;
    status: TerminalStatus;
    lastReceivedAt: string | null;
    lastEventAt: string | null;
    lagMinutes: number | null;
}

export interface Summary {
    aborted: { total: number; terminals: number; top: { id: number; name: string; schoolName: string | null; count: number }[] };
    terminals: { total: number; realtime: number; lagging: number; idle: number; never: number };
    attention: AttentionTerminal[];
    today: { source: Source; received: number; inserted: number; duplicates: number; withPicture: number; withoutPicture: number; maxLagSeconds: number }[];
}

export interface DayHourSide {
    received: number;
    inserted: number;
    duplicates: number;
    terminals: number;
}

export interface DayTerminal {
    terminalId: number;
    terminalName: string | null;
    schoolName: string | null;
    push: {
        received: number;
        inserted: number;
        duplicates: number;
        withPicture: number;
        withoutPicture: number;
        maxLagSeconds: number;
    };
    pull: { received: number; inserted: number };
}

export interface DayResponse {
    date: string;
    hours: { hour: number; push: DayHourSide; pull: DayHourSide }[];
    terminals: DayTerminal[];
    totals: {
        pushReceived: number;
        pushInserted: number;
        pushDuplicates: number;
        pushWithPicture: number;
        pushWithoutPicture: number;
        pullInserted: number;
        terminals: number;
    };
}

/** Kechikishni odam tilida: «real vaqtda», «12 daqiqa», «5 soat 3 daqiqa», «46 kun 2 soat». */
export function humanLag(seconds: number, t: TFunction): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 2) return t('syncHistory.push.realtime');
    if (minutes < 60) return t('syncHistory.push.lagM', { m: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return t('syncHistory.push.lagHm', { h: hours, m: minutes % 60 });
    return t('syncHistory.push.lagD', { d: Math.floor(hours / 24), h: hours % 24 });
}

export function percent(part: number, total: number): number | null {
    return total > 0 ? Math.round((100 * part) / total) : null;
}
