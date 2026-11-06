export interface GroupableAttendanceEvent {
  id: string;
  terminalId: number;
  pnfl: string;
  direction: string;
  eventAt: Date;
}

export interface AttendanceEventGroup<T> {
  firstEvent: T;
  lastEvent: T;
  eventCount: number;
}

export function groupAttendanceEvents<T extends GroupableAttendanceEvent>(
  events: readonly T[],
  maxGapSeconds = 5,
): AttendanceEventGroup<T>[] {
  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds < 0) {
    throw new Error('Vaqt oralig‘i noto‘g‘ri');
  }

  const sorted = [...events].sort(
    (a, b) =>
      a.eventAt.getTime() - b.eventAt.getTime() || a.id.localeCompare(b.id),
  );

  const groups: AttendanceEventGroup<T>[] = [];
  const lastGroupByKey = new Map<string, AttendanceEventGroup<T>>();

  for (const event of sorted) {
    const key = JSON.stringify([event.terminalId, event.pnfl, event.direction]);

    const previous = lastGroupByKey.get(key);

    const gapMs = previous
      ? event.eventAt.getTime() - previous.lastEvent.eventAt.getTime()
      : Infinity;

    if (previous && gapMs <= maxGapSeconds * 1000) {
      previous.lastEvent = event;
      previous.eventCount++;
      continue;
    }

    const group: AttendanceEventGroup<T> = {
      firstEvent: event,
      lastEvent: event,
      eventCount: 1,
    };

    groups.push(group);
    lastGroupByKey.set(key, group);
  }

  return groups;
}
