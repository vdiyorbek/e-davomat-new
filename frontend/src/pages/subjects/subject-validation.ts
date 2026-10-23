import type { SubjectValues } from './subject-form';

/** Fan maydonlarini tekshiradi; xato bo‘lsa i18n kalitini qaytaradi. */
export function validateSubject(values: SubjectValues): string | null {
    const code = values.code.trim().toUpperCase();
    const nameUz = values.nameUz.trim();
    const nameRu = values.nameRu.trim();
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) return 'subjects.errors.code';
    if (nameUz.length < 2 || nameUz.length > 150 || nameRu.length > 150 || (nameRu.length > 0 && nameRu.length < 2)) {
        return 'subjects.errors.name';
    }
    return null;
}
