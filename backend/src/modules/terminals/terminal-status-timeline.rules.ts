import { HEALTH_GAP_MS } from './terminal-health.constants';
import { TerminalStatus } from './terminal-status-period.entity';

export type TimelineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface PeriodRow {
  status: TerminalStatus;
  startedAt: Date;
  endedAt: Date | null;
  lastCheckAt: Date;
  lastError: string | null;
}

export interface TimelineSegment {
  status: TimelineStatus;
  from: Date;
  to: Date;
}

export interface DayTimeline {
  segments: TimelineSegment[];
  onlineMs: number;
  offlineMs: number;
  unknownMs: number;
  /** Ma’lum vaqtning necha foizida online bo‘lgan (ma’lumot yo‘q bo‘lsa — null). */
  uptimePercent: number | null;
  outages: Array<{
    startedAt: Date;
    endedAt: Date | null;
    durationMs: number;
    lastError: string | null;
  }>;
  /** Faqat bugun uchun: hozirgi holat va qachondan beri. */
  current: { status: TimelineStatus; since: Date | null } | null;
}

/**
 * Ochiq davr qayerda tugaydi: tekshiruv yaqinda bo‘lgan bo‘lsa — hozir,
 * aks holda (backend to‘xtagan) — oxirgi tekshiruvda.
 */
function effectiveEnd(period: PeriodRow, now: Date): Date {
  if (period.endedAt) return period.endedAt;
  return now.getTime() - period.lastCheckAt.getTime() <= HEALTH_GAP_MS
    ? now
    : period.lastCheckAt;
}

/**
 * Bir kunlik vaqt chizig‘i: [dayStart, min(dayEnd, now)] oralig‘ini
 * ONLINE / OFFLINE / UNKNOWN (ma’lumot yo‘q) bo‘laklariga ajratadi.
 */
export function buildDayTimeline(
  periods: PeriodRow[],
  dayStart: Date,
  dayEnd: Date,
  now: Date,
): DayTimeline {
  const rangeEnd = new Date(Math.min(dayEnd.getTime(), now.getTime()));
  const isToday = rangeEnd.getTime() === now.getTime();

  const sorted = [...periods].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );

  const raw: TimelineSegment[] = [];
  let cursor = dayStart;

  const push = (status: TimelineStatus, from: Date, to: Date) => {
    if (to.getTime() <= from.getTime()) return;
    const last = raw[raw.length - 1];
    if (
      last &&
      last.status === status &&
      last.to.getTime() === from.getTime()
    ) {
      last.to = to;
    } else {
      raw.push({ status, from, to });
    }
  };

  const outages: DayTimeline['outages'] = [];

  for (const period of sorted) {
    const end = effectiveEnd(period, now);
    const from = new Date(
      Math.max(period.startedAt.getTime(), dayStart.getTime()),
    );
    const to = new Date(Math.min(end.getTime(), rangeEnd.getTime()));

    if (to.getTime() <= from.getTime() || to.getTime() <= cursor.getTime()) {
      continue;
    }

    const start = from.getTime() < cursor.getTime() ? cursor : from;

    push('UNKNOWN', cursor, start);
    push(period.status, start, to);
    cursor = to;

    if (period.status === TerminalStatus.OFFLINE) {
      outages.push({
        startedAt: period.startedAt,
        endedAt: period.endedAt,
        durationMs: end.getTime() - period.startedAt.getTime(),
        lastError: period.lastError,
      });
    }
  }

  push('UNKNOWN', cursor, rangeEnd);

  const total = (status: TimelineStatus) =>
    raw
      .filter((segment) => segment.status === status)
      .reduce(
        (sum, segment) => sum + (segment.to.getTime() - segment.from.getTime()),
        0,
      );

  const onlineMs = total('ONLINE');
  const offlineMs = total('OFFLINE');
  const known = onlineMs + offlineMs;

  let current: DayTimeline['current'] = null;

  if (isToday) {
    const last = raw[raw.length - 1];
    const open = sorted.find(
      (period) =>
        !period.endedAt &&
        effectiveEnd(period, now).getTime() === now.getTime(),
    );

    current =
      last && last.status !== 'UNKNOWN' && open
        ? { status: open.status, since: open.startedAt }
        : { status: 'UNKNOWN', since: null };
  }

  return {
    segments: raw,
    onlineMs,
    offlineMs,
    unknownMs: total('UNKNOWN'),
    uptimePercent:
      known > 0 ? Math.round((onlineMs / known) * 1000) / 10 : null,
    outages,
    current,
  };
}
