import i18n from 'i18next';
import type { BackendModule, ResourceLanguage } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/**
 * Tarjimalar `locales/<til>/<bo‘lim>.json` ko‘rinishida saqlanadi.
 * Har bir fayl nomi kalitning birinchi qismiga aylanadi:
 *   locales/uz/attendance.json  →  t('attendance.title')
 * Yangi bo‘lim qo‘shish uchun to‘rtala til papkasiga bir xil nomli fayl qo‘shing.
 */
export const LANGUAGES = [
    { code: 'uz', short: 'UZ', label: 'O‘zbekcha', intl: 'uz-Latn-UZ' },
    { code: 'uz-Cyrl', short: 'ЎЗ', label: 'Ўзбекча', intl: 'uz-Cyrl-UZ' },
    { code: 'ru', short: 'RU', label: 'Русский', intl: 'ru-RU' },
    { code: 'en', short: 'EN', label: 'English', intl: 'en-GB' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

// Har bir til alohida yuklanadi: foydalanuvchi faqat tanlangan til faylini oladi.
const modules = import.meta.glob<{ default: ResourceLanguage }>('./locales/*/*.json');

async function loadLanguage(lng: string): Promise<ResourceLanguage> {
    const entries = Object.entries(modules).filter(([path]) => path.startsWith(`./locales/${lng}/`));
    const sections = await Promise.all(
        entries.map(async ([path, load]) => {
            const section = /\/([^/]+)\.json$/.exec(path)?.[1] ?? '';
            return [section, (await load()).default] as const;
        }),
    );
    return Object.fromEntries(sections);
}

const lazyBackend: BackendModule = {
    type: 'backend',
    init: () => undefined,
    read(language, _namespace, callback) {
        loadLanguage(language)
            .then((resources) => callback(null, resources))
            .catch((error: unknown) => callback(error as Error, false));
    },
};

void i18n
    .use(lazyBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'uz',
        supportedLngs: LANGUAGES.map((l) => l.code),
        nonExplicitSupportedLngs: false,
        load: 'currentOnly',
        interpolation: { escapeValue: false },
        returnNull: false,
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'edavomat-lang',
            caches: ['localStorage'],
        },
    });

/** i18next tilini Intl API uchun BCP-47 lokalga aylantiradi. */
export function intlLocale(lng: string | undefined = i18n.resolvedLanguage): string {
    return LANGUAGES.find((l) => l.code === lng)?.intl ?? 'uz-Latn-UZ';
}

function syncDocument() {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'uz';
    if (i18n.exists('brand.documentTitle')) document.title = i18n.t('brand.documentTitle');
}

i18n.on('languageChanged', syncDocument);
i18n.on('loaded', syncDocument);

export default i18n;
