/** Ingest serveri yozadigan, worker o‘qiydigan Redis Stream. */
export const PUSH_STREAM_KEY = 'edav:push:events';
export const PUSH_STREAM_GROUP = 'push-workers';

/** Terminal tokenlari o‘zgarganda ingest keshini darhol yangilash kanali. */
export const PUSH_TERMINALS_CHANGED_CHANNEL = 'edav:push:terminals-changed';

/** Real vaqt sahifasi uchun: `edav:live:school:<schoolId>`. */
export const LIVE_CHANNEL_PREFIX = 'edav:live:school:';

/** Terminal «kechikmoqda» (eski eventlar kelyapti) belgisi: edav:push:lag:<terminalId>. */
export const PUSH_LAG_KEY_PREFIX = 'edav:push:lag:';
/** Kunlik hash: terminalId → terminal ulanishni uzgan so‘rovlar soni (aborted). */
export const PUSH_ABORTED_KEY_PREFIX = 'edav:push:aborted:';

/** Kun uchun daily_attendance qatorlari to‘liq yaratilganini bildiradi. */
export const dailySeededKey = (schoolId: number, date: string) =>
  `edav:daily:seeded:${schoolId}:${date}`;

/** Stream xabarining `d` maydoni (JSON). Qisqa kalitlar — Redis xotirasini tejaydi. */
export interface PushStreamEvent {
  /** terminalId */
  t: number;
  /** schoolId */
  s: number;
  /** direction: IN | OUT */
  d: string;
  /** pnfl */
  p: string;
  /** serialNo */
  n: string;
  /** eventAt ISO */
  at: string;
  mj: number;
  mn: number;
  /** pictureURL */
  u: string | null;
  /** push bilan kelgan va diskka yozilgan rasm (nisbiy yo‘l) */
  ph: string | null;
}

export interface LiveEvent {
  eventId: string;
  terminalId: number;
  direction: string;
  eventAt: string;
  pnfl: string;
  hasPhoto: boolean;
  person: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
  } | null;
  membershipType: 'STUDENT' | 'TEACHER' | null;
  className: string | null;
}

/** Toshkent (UTC+05:00) sanasi. */
export function tashkentDate(at: Date): string {
  return new Date(at.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
