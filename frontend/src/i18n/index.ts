import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import uz from './locales/uz.json';
import uzCyrl from './locales/uz-Cyrl.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

export const LANGUAGES = [
    { code: 'uz', short: 'UZ', label: 'O‘zbekcha' },
    { code: 'uz-Cyrl', short: 'ЎЗ', label: 'Ўзбекча' },
    { code: 'ru', short: 'RU', label: 'Русский' },
    { code: 'en', short: 'EN', label: 'English' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            uz: { translation: uz },
            'uz-Cyrl': { translation: uzCyrl },
            ru: { translation: ru },
            en: { translation: en },
        },
        fallbackLng: 'uz',
        supportedLngs: LANGUAGES.map((l) => l.code),
        nonExplicitSupportedLngs: false,
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'edavomat-lang',
            caches: ['localStorage'],
        },
    });

function syncHtmlLang(lng: string) {
    document.documentElement.lang = lng === 'uz-Cyrl' ? 'uz-Cyrl' : lng;
}
syncHtmlLang(i18n.resolvedLanguage ?? 'uz');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
