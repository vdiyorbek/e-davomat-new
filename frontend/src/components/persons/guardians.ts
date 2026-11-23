import type { Guardian, Guardians } from '@/types/person';

/** Forma ichidagi bitta ota yoki ona (hamma maydon matn). */
export interface GuardianValue {
    lastName: string;
    firstName: string;
    middleName: string;
    phoneNumber: string;
}

export interface GuardiansValue {
    father: GuardianValue;
    mother: GuardianValue;
}

export const EMPTY_GUARDIAN: GuardianValue = { lastName: '', firstName: '', middleName: '', phoneNumber: '' };

const PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/;

function fromApi(guardian: Guardian | null): GuardianValue {
    return {
        lastName: guardian?.lastName ?? '',
        firstName: guardian?.firstName ?? '',
        middleName: guardian?.middleName ?? '',
        phoneNumber: guardian?.phoneNumber ?? '',
    };
}

export function guardiansFromApi(data: Guardians | null): GuardiansValue {
    return { father: fromApi(data?.father ?? null), mother: fromApi(data?.mother ?? null) };
}

export function isGuardianEmpty(value: GuardianValue): boolean {
    return !value.lastName.trim() && !value.firstName.trim() && !value.middleName.trim() && !value.phoneNumber.trim();
}

export function sameGuardian(a: GuardianValue, b: GuardianValue): boolean {
    return (
        a.lastName.trim() === b.lastName.trim() &&
        a.firstName.trim() === b.firstName.trim() &&
        a.middleName.trim() === b.middleName.trim() &&
        a.phoneNumber.trim() === b.phoneNumber.trim()
    );
}

/** Yuboriladigan ko‘rinish: bo‘sh bo‘lsa null (serverda o‘chiriladi). */
export function guardianPayload(value: GuardianValue) {
    if (isGuardianEmpty(value)) return null;
    return {
        lastName: value.lastName.trim() || null,
        firstName: value.firstName.trim() || null,
        middleName: value.middleName.trim() || null,
        phoneNumber: value.phoneNumber.trim() || null,
    };
}

/** Xato bo‘lsa i18n kalitini qaytaradi. */
export function validateGuardian(value: GuardianValue): string | null {
    const length = (text: string) => Array.from(text.trim()).length;
    if (length(value.lastName) > 100 || length(value.firstName) > 100 || length(value.middleName) > 100) {
        return 'persons.guardians.errors.nameLength';
    }
    if (value.phoneNumber.trim() && !PHONE_PATTERN.test(value.phoneNumber.trim())) return 'persons.guardians.errors.phone';
    return null;
}

export function fullGuardianName(value: Guardian | null): string {
    return [value?.lastName, value?.firstName, value?.middleName].filter(Boolean).join(' ');
}

function isGuardianComplete(value: GuardianValue): boolean {
    return Boolean(value.lastName.trim() && value.firstName.trim() && value.phoneNumber.trim());
}

/**
 * Yangi o‘quvchi uchun: kamida bitta ota yoki ona to‘liq (familiya, ism, telefon) kiritilishi kerak;
 * qisman to‘ldirilgani xato. Xato bo‘lsa i18n kalitini qaytaradi.
 */
export function validateGuardiansRequired(value: GuardiansValue): string | null {
    const list = [value.father, value.mother];
    for (const item of list) {
        const invalid = validateGuardian(item);
        if (invalid) return invalid;
        if (!isGuardianEmpty(item) && !isGuardianComplete(item)) return 'members.errors.guardianIncomplete';
    }
    return list.some(isGuardianComplete) ? null : 'members.errors.needGuardian';
}
