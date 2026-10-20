import i18n from '@/i18n';
import { translitUzLatnToCyrl } from '@/lib/translit';

interface LocalizedNames {
    nameUz: string;
    nameUzCyrl?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
}

/**
 * Backenddan keladigan ko‘p tilli nomlarni (masalan, fanlar) tanlangan tilga mos qaytaradi.
 * Hozircha backend faqat `nameUz` beradi: kirill yozuvi uchun avtomatik transliteratsiya,
 * boshqa tillar uchun — mavjud bo‘lsa `nameRu` / `nameEn`, aks holda `nameUz`.
 */
export function localizedName(item: LocalizedNames): string {
    switch (i18n.resolvedLanguage) {
        case 'uz-Cyrl':
            return item.nameUzCyrl || translitUzLatnToCyrl(item.nameUz);
        case 'ru':
            return item.nameRu || item.nameUz;
        case 'en':
            return item.nameEn || item.nameUz;
        default:
            return item.nameUz;
    }
}
