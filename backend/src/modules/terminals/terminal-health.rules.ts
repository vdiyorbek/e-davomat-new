import { OFFLINE_AFTER_FAILURES } from './terminal-health.constants';

export type TerminalHealthStatus =
  'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'DISABLED' | 'ARCHIVED';

/** Health natijasi shundan eski bo‘lsa, unga ishonmaymiz. */
export const HEALTH_MAX_AGE_MS = 5 * 60 * 1000;

/** Eventlar shundan ko‘p kechiksa — «sinxronlash kechikmoqda». */
export const SYNC_DELAY_LIMIT_MS = 10 * 60 * 1000;

interface HealthFields {
  archivedAt: Date | null;
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastSeenAt: Date | null;
  consecutiveFailures: number;
}

/**
 * Terminal holati (ro‘yxatdagi belgi uchun).
 * Quyidagi `healthStatusSql` bilan AYNAN bir xil qoida —
 * ikkalasini birga o‘zgartiring.
 */
export function getTerminalHealthStatus(
  terminal: HealthFields,
  now = Date.now(),
): TerminalHealthStatus {
  if (terminal.archivedAt) return 'ARCHIVED';
  if (!terminal.isActive) return 'DISABLED';

  const checkedAt = terminal.lastCheckedAt
    ? new Date(terminal.lastCheckedAt).getTime()
    : NaN;

  // Tekshiruv yo‘q, eskirgan yoki kelajakda (soat noto‘g‘ri).
  if (
    !Number.isFinite(checkedAt) ||
    checkedAt < now - HEALTH_MAX_AGE_MS ||
    checkedAt > now + 60_000
  ) {
    return 'UNKNOWN';
  }

  // Bitta xato — qisqa uzilish bo‘lishi mumkin; holatlar
  // tarixi bilan bir xil chegara ishlatiladi.
  if (terminal.consecutiveFailures >= OFFLINE_AFTER_FAILURES) {
    return 'OFFLINE';
  }

  const seenAt = terminal.lastSeenAt
    ? new Date(terminal.lastSeenAt).getTime()
    : NaN;

  if (Number.isFinite(seenAt) && seenAt >= now - HEALTH_MAX_AGE_MS) {
    return 'ONLINE';
  }

  return 'UNKNOWN';
}

/** `getTerminalHealthStatus` ning SQL ko‘rinishi (filtr va hisob uchun). */
export function healthStatusSql(alias: string): string {
  return `(CASE
    WHEN ${alias}.archivedAt IS NOT NULL THEN 'ARCHIVED'
    WHEN ${alias}.isActive = 0 THEN 'DISABLED'
    WHEN ${alias}.lastCheckedAt IS NULL
      OR ${alias}.lastCheckedAt < :healthStaleBefore
      OR ${alias}.lastCheckedAt > :healthFutureLimit THEN 'UNKNOWN'
    WHEN ${alias}.consecutiveFailures >= :offlineAfterFailures THEN 'OFFLINE'
    WHEN ${alias}.lastSeenAt >= :healthStaleBefore THEN 'ONLINE'
    ELSE 'UNKNOWN'
  END)`;
}

/** Sinxronlash kechikmoqda: faol terminal, eventlar 10 daqiqadan ko‘p kechikkan. */
export function syncDelayedSql(alias: string): string {
  return `(${alias}.archivedAt IS NULL
    AND ${alias}.isActive = 1
    AND ${alias}.eventsSyncedUntil IS NOT NULL
    AND ${alias}.eventsSyncedUntil < :syncDelayedBefore)`;
}

/** Yuqoridagi SQL ifodalar uchun parametrlar (vaqt JS’da hisoblanadi). */
export function healthSqlParams(now = Date.now()) {
  return {
    healthStaleBefore: new Date(now - HEALTH_MAX_AGE_MS),
    healthFutureLimit: new Date(now + 60_000),
    offlineAfterFailures: OFFLINE_AFTER_FAILURES,
    syncDelayedBefore: new Date(now - SYNC_DELAY_LIMIT_MS),
  };
}
