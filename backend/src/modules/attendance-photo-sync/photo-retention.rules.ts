import { isAbsolute, relative, resolve, sep } from 'node:path';

export const DEFAULT_RETENTION_DAYS = 90;
export const MIN_RETENTION_DAYS = 7;
export const ATTENDANCE_PHOTO_ROOT = 'uploads/attendance';

/** null qaytsa, tozalash o'chiq. */
export function parseRetentionDays(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return DEFAULT_RETENTION_DAYS;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) return DEFAULT_RETENTION_DAYS;
  if (value === 0) return null;

  return Math.max(value, MIN_RETENTION_DAYS);
}

export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Bazadagi nisbiy yo'l faqat uploads/attendance ichidagi faylga
 * ishora qilsa, absolyut yo'lni qaytaradi. Aks holda null.
 */
export function safeAttendancePhotoPath(
  photoPath: string,
  cwd: string,
): string | null {
  const root = resolve(cwd, ATTENDANCE_PHOTO_ROOT);
  const target = resolve(cwd, photoPath);
  const rel = relative(root, target);

  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  if (rel.split(sep).length < 1) return null;

  return target;
}
