import { todayInTashkent } from '@/lib/date';

import type { ResidenceValue } from './ResidenceFields';

export interface PersonFieldsValue {
    lastName: string;
    firstName: string;
    middleName: string;
    gender: '' | 'MALE' | 'FEMALE';
    birthDate: string;
    nationality: string;
    phoneNumber: string;
    address: string;
    residence: ResidenceValue;
}

export const EMPTY_PERSON_FIELDS: PersonFieldsValue = {
    lastName: '',
    firstName: '',
    middleName: '',
    gender: '',
    birthDate: '',
    nationality: '',
    phoneNumber: '',
    address: '',
    residence: { regionId: null, districtId: null, mahallaId: null },
};

const PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export function isValidDate(value: string): boolean {
    if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Shaxs maydonlarini tekshiradi. Xato bo‘lsa i18n kalitini qaytaradi. */
export function validatePersonFields(value: PersonFieldsValue): string | null {
    const length = (text: string) => Array.from(text.trim()).length;

    if (length(value.firstName) < 1 || length(value.firstName) > 100 || length(value.lastName) < 1 || length(value.lastName) > 100) {
        return 'persons.errors.nameLength';
    }
    if (length(value.middleName) > 100) return 'persons.errors.middleNameLength';
    if (value.birthDate) {
        if (!isValidDate(value.birthDate)) return 'persons.errors.birthDate';
        if (value.birthDate > todayInTashkent()) return 'persons.errors.birthDateFuture';
    }
    if (length(value.nationality) > 100) return 'persons.errors.nationalityLength';
    if (value.phoneNumber.trim() && !PHONE_PATTERN.test(value.phoneNumber.trim())) return 'persons.errors.phone';
    if (length(value.address) > 500) return 'persons.errors.addressLength';
    return null;
}

/** Yangi o‘quvchi uchun majburiy maydonlar. Xato bo‘lsa i18n kalitini qaytaradi. */
export function validateStudentRequired(value: PersonFieldsValue): string | null {
    if (!value.middleName.trim()) return 'members.errors.needMiddleName';
    if (!value.gender) return 'members.errors.needGender';
    if (!value.birthDate) return 'members.errors.needBirthDate';
    if (!value.nationality.trim()) return 'members.errors.needNationality';
    if (value.residence.mahallaId === null) return 'members.errors.chooseMahalla';
    if (!value.address.trim()) return 'members.errors.needAddress';
    return null;
}
