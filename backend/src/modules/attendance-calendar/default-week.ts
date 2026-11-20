/**
 * Standart o‘quv haftasi: maktab/sinf uchun haftalik jadval kiritilmagan bo‘lsa ishlaydi.
 * (Bayram/ta’til qoidalari va kiritilgan haftalik jadval ustun turadi.)
 *
 *  • 1–4 sinf o‘quvchilari — «boshlang‘ich» hafta (standart: 5 kun, Dushanba–Juma);
 *  • 5–11 sinf o‘quvchilari — umumiy hafta (standart: 6 kun, Dushanba–Shanba);
 *  • o‘qituvchi faqat 1–4 sinflarda dars bersa — boshlang‘ich hafta, aks holda umumiy.
 * Hafta kunlari soni Dushanbadan boshlab sanaladi (5 = Du–Ju, 6 = Du–Sha, 7 = har kuni).
 */
export interface DefaultWeekConfig {
  primaryMaxGrade: number;
  primaryDays: number;
  generalDays: number;
}

export interface DefaultWeekSubject {
  isStudent: boolean;
  /** O‘quvchining sinf darajasi (1–11). */
  grade?: number | null;
  /** O‘qituvchi faqat boshlang‘ich sinflarda dars beradimi. */
  primaryOnly?: boolean;
}

export function defaultWeekDays(
  config: DefaultWeekConfig,
  subject: DefaultWeekSubject,
): number {
  const primary = subject.isStudent
    ? subject.grade != null &&
      subject.grade >= 1 &&
      subject.grade <= config.primaryMaxGrade
    : subject.primaryOnly === true;

  return primary ? config.primaryDays : config.generalDays;
}

/** weekdayIndex: Dushanba = 0 … Yakshanba = 6. */
export function isDefaultWorkDay(
  config: DefaultWeekConfig,
  subject: DefaultWeekSubject,
  weekdayIndex: number,
): boolean {
  return weekdayIndex < defaultWeekDays(config, subject);
}
