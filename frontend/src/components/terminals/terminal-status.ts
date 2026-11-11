import type { TFunction } from 'i18next';

import type { StatusTone } from '@/components/common/StatusBadge';
import type { Terminal } from '@/types/terminal';

export interface BadgeInfo {
    text: string;
    tone: StatusTone;
}

export function isArchived(terminal: Terminal): boolean {
    return Boolean(terminal.archivedAt);
}

/** Qurilmaning tarmoq holati — faqat HealthCheck natijasiga asoslanadi. */
export function connectionBadge(terminal: Terminal, t: TFunction): BadgeInfo {
    // Health scheduler arxivlangan yoki nofaol qurilmalarni so‘ramaydi —
    // ularni asossiz «Offline» deb ko‘rsatmaymiz.
    if (isArchived(terminal) || !terminal.isActive) {
        return { text: t('terminals.connection.notChecked'), tone: 'neutral' };
    }
    switch (terminal.healthStatus) {
        case 'ONLINE':
            return { text: t('terminals.connection.ONLINE'), tone: 'success' };
        case 'OFFLINE':
            return { text: t('terminals.connection.OFFLINE'), tone: 'danger' };
        default:
            return { text: t('terminals.connection.UNKNOWN'), tone: 'neutral' };
    }
}

/** Terminalning tizimdagi holati — HealthCheck’dan mustaqil. */
export function systemBadge(terminal: Terminal, t: TFunction): BadgeInfo {
    if (isArchived(terminal)) return { text: t('terminals.system.archived'), tone: 'neutral' };
    if (!terminal.isActive) return { text: t('terminals.system.inactive'), tone: 'warning' };
    return { text: t('terminals.system.active'), tone: 'info' };
}

export type SyncKind = 'disabled' | 'notStarted' | 'unknown' | 'pending' | 'healthy' | 'delayed';

export interface SyncInfo extends BadgeInfo {
    kind: SyncKind;
    /** Kechikish matni yoki `null` (hisoblab bo‘lmasa). */
    delay: string | null;
}

/** Sinxronlash kechikishi 10 daqiqadan oshsa — «kechikmoqda». */
const HEALTHY_DELAY_SECONDS = 600;

export function formatDelay(seconds: number, t: TFunction): string {
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 1440) return t('terminals.delay.days', { count: Math.floor(minutes / 1440) });
    if (minutes >= 60) return t('terminals.delay.hours', { count: Math.floor(minutes / 60) });
    return t('terminals.delay.minutes', { count: minutes });
}

export function syncInfo(terminal: Terminal, now: number, t: TFunction): SyncInfo {
    const make = (kind: SyncKind, tone: StatusTone, delay: string | null = null): SyncInfo => ({
        kind,
        tone,
        delay,
        text: t(`terminals.syncStatus.${kind}`),
    });

    if (isArchived(terminal) || !terminal.isActive) return make('disabled', 'neutral');
    if (!terminal.syncStartAt) return make('notStarted', 'warning');

    const cursor = new Date(terminal.eventsSyncedUntil ?? terminal.syncStartAt).getTime();
    if (!Number.isFinite(cursor)) return make('unknown', 'neutral');

    const delaySeconds = Math.max(0, Math.floor((now - cursor) / 1000));
    const delay = formatDelay(delaySeconds, t);

    if (!terminal.eventsSyncedUntil) return make('pending', 'warning', delay);
    if (delaySeconds <= HEALTHY_DELAY_SECONDS) return make('healthy', 'success', delay);
    return make('delayed', 'danger', delay);
}
