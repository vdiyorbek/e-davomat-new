/** Rasm fayllari uchun umumiy cheklovlar. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Rasm faylini tekshiradi; xato bo‘lsa i18n kalitini qaytaradi. */
export function validateImage(file: File): string | null {
    if (!IMAGE_TYPES.includes(file.type)) return 'photo.wrongType';
    if (file.size === 0) return 'file.empty';
    if (file.size > MAX_IMAGE_BYTES) return 'photo.tooLarge';
    return null;
}
