import {
  HEALTH_GAP_MS,
  OFFLINE_AFTER_FAILURES,
} from './terminal-health.constants';
import { TerminalStatus } from './terminal-status-period.entity';

export interface OpenPeriod {
  status: TerminalStatus;
  startedAt: Date;
  lastCheckAt: Date;
}

export interface HealthCheck {
  ok: boolean;
  at: Date;
  /** Shu tekshiruvdan keyingi ketma-ket xatolar soni (muvaffaqiyatda 0). */
  failures: number;
  /** Ketma-ket xatolarning birinchisi qachon bo‘lgan (bo‘lmasa — null). */
  firstFailureAt: Date | null;
}

export interface StatusPlan {
  /** Ochiq davrni shu vaqtda yopish. */
  closeAt: Date | null;
  /** Yangi davr ochish. */
  open: { status: TerminalStatus; startedAt: Date } | null;
  /** Ochiq davrni davom ettirish (lastCheckAt, checks). */
  extend: boolean;
}

const NOTHING: StatusPlan = { closeAt: null, open: null, extend: false };

/**
 * Bitta health tekshiruvidan keyin holatlar tarixida nima qilish kerak.
 * Sof funksiya: bazaga tegmaydi, shuning uchun to‘liq test qilinadi.
 */
export function planStatusChange(
  current: OpenPeriod | null,
  check: HealthCheck,
): StatusPlan {
  let open = current;
  let closeAt: Date | null = null;

  // Uzoq bo‘shliq (backend to‘xtagan): oldingi davr oxirgi
  // tekshiruvda tugagan deb hisoblanadi, oradagi vaqt — noma’lum.
  if (open && check.at.getTime() - open.lastCheckAt.getTime() > HEALTH_GAP_MS) {
    closeAt = open.lastCheckAt;
    open = null;
  }

  const desired = check.ok
    ? TerminalStatus.ONLINE
    : check.failures >= OFFLINE_AFTER_FAILURES
      ? TerminalStatus.OFFLINE
      : null; // bitta-ikkita xato — hali qaror yo‘q

  if (desired === null) {
    return open
      ? { closeAt, open: null, extend: true }
      : closeAt
        ? { ...NOTHING, closeAt }
        : NOTHING;
  }

  if (open && open.status === desired) {
    return { closeAt, open: null, extend: true };
  }

  // Holat o‘zgardi. Offline birinchi xatodan boshlangan hisoblanadi.
  let startedAt =
    desired === TerminalStatus.OFFLINE
      ? (check.firstFailureAt ?? check.at)
      : check.at;

  // Yangi davr eskisidan oldin boshlanmasligi kerak.
  if (open && startedAt.getTime() < open.startedAt.getTime()) {
    startedAt = open.startedAt;
  }

  return {
    closeAt: open ? startedAt : closeAt,
    open: { status: desired, startedAt },
    extend: false,
  };
}
