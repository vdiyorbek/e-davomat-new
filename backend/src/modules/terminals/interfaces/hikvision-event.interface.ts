export interface HikvisionEvent {
  major: number;
  minor: number;
  time: string;

  serialNo: number | string;

  employeeNoString?: string;
  currentVerifyMode?: string;
  pictureURL?: string;

  name?: string;
  doorNo?: number;
}

export interface HikvisionEventsBatch {
  events: HikvisionEvent[];
  // Formati noto‘g‘ri bo‘lgani uchun tashlab yuborilgan eventlar soni.
  invalidCount: number;
}

export interface HikvisionEventsPage extends HikvisionEventsBatch {
  hasMore: boolean;
  totalMatches: number;
  // Terminal qaytargan xom ro‘yxat bo‘yicha hisoblanadi.
  fingerprint: string;
}
