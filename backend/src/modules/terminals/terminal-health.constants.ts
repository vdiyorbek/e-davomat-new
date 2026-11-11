/**
 * Terminal holatini aniqlash qoidalari — bitta joyda.
 * Health scheduler, holatlar tarixi va «Online/Offline» belgisi
 * shu qiymatlardan foydalanadi.
 */

/** Health tekshiruvi oralig‘i (TerminalHealthScheduler cron: har 2 daqiqa). */
export const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Ketma-ket nechta muvaffaqiyatsiz tekshiruvdan keyin terminal
 * «Offline» hisoblanadi. 1 ta xato ko‘pincha tarmoqdagi qisqa uzilish.
 */
export const OFFLINE_AFTER_FAILURES = 2;

/**
 * Ikki tekshiruv orasidagi bo‘shliq bundan katta bo‘lsa (masalan,
 * backend to‘xtab qolgan), joriy davr yopiladi: bu vaqtdagi holat
 * noma’lum, uni «Online» yoki «Offline» deb ko‘rsatmaymiz.
 */
export const HEALTH_GAP_MS = 10 * 60 * 1000;
