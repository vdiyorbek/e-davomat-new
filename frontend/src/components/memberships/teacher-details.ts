export type TeacherDetailKey =
    | 'employeeNumber'
    | 'position'
    | 'employmentType'
    | 'qualificationCategory'
    | 'specialization'
    | 'educationLevel'
    | 'hireOrderNumber';

export type TeacherDetailsValue = Record<TeacherDetailKey, string>;

export interface TeacherDetailsResponse {
    membershipId: number;
    details: (Partial<Record<TeacherDetailKey, string | null>> & { id: number }) | null;
}

export const TEACHER_DETAIL_FIELDS: { key: TeacherDetailKey; maxLength: number; placeholder?: string }[] = [
    { key: 'employeeNumber', maxLength: 50, placeholder: 'EMP-001' },
    { key: 'position', maxLength: 150 },
    { key: 'employmentType', maxLength: 50 },
    { key: 'qualificationCategory', maxLength: 100 },
    { key: 'specialization', maxLength: 150 },
    { key: 'educationLevel', maxLength: 100 },
    { key: 'hireOrderNumber', maxLength: 100, placeholder: '112-K' },
];

export function teacherDetailsFromApi(data: TeacherDetailsResponse | null): TeacherDetailsValue {
    const value = {} as TeacherDetailsValue;
    for (const field of TEACHER_DETAIL_FIELDS) value[field.key] = data?.details?.[field.key] ?? '';
    return value;
}

export function teacherDetailsPayload(value: TeacherDetailsValue): Record<string, string | null> {
    const payload: Record<string, string | null> = {};
    for (const field of TEACHER_DETAIL_FIELDS) payload[field.key] = value[field.key].trim() || null;
    return payload;
}

export function sameTeacherDetails(a: TeacherDetailsValue, b: TeacherDetailsValue): boolean {
    return TEACHER_DETAIL_FIELDS.every((field) => a[field.key].trim() === b[field.key].trim());
}
