
import { useEffect, useState } from 'react';

import { Field } from '@/components/common/Field';
import {
    ErrorState,
    LoadingState,
} from '@/components/common/states';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPut } from '@/lib/auth-session';

import type { SchoolMembership } from
    '@/types/school-membership';
import { SelectField } from
    '@/components/common/SelectField';

import {
    MEMBERSHIP_OPTIONS,
    membershipOptions,
    type MembershipSelectKey,
} from './membership-detail-options';
type FieldKey =
    | 'studentNumber'
    | 'admissionOrderNumber'
    | 'educationLanguage'
    | 'educationForm'
    | 'employeeNumber'
    | 'position'
    | 'employmentType'
    | 'qualificationCategory'
    | 'specialization'
    | 'educationLevel'
    | 'hireOrderNumber';

type FieldValues = Record<FieldKey, string>;
function isSelectField(
    key: FieldKey,
): key is MembershipSelectKey {
    return key in MEMBERSHIP_OPTIONS;
}
interface FieldDefinition {
    key: FieldKey;
    label: string;
    maxLength: number;
    placeholder?: string;
}

interface DetailsResponse {
    membershipId: number;
    details: (
        Partial<Record<FieldKey, string | null>> & {
            id: number;
        }
    ) | null;
}

const EMPTY_VALUES: FieldValues = {
    studentNumber: '',
    admissionOrderNumber: '',
    educationLanguage: '',
    educationForm: '',
    employeeNumber: '',
    position: '',
    employmentType: '',
    qualificationCategory: '',
    specialization: '',
    educationLevel: '',
    hireOrderNumber: '',
};

const STUDENT_FIELDS: FieldDefinition[] = [
    {
        key: 'studentNumber',
        label: 'O‘quvchi raqami',
        maxLength: 50,
        placeholder: 'ST-2026-001',
    },
    {
        key: 'admissionOrderNumber',
        label: 'Qabul buyrug‘i raqami',
        maxLength: 100,
        placeholder: '45-A',
    },
    {
        key: 'educationLanguage',
        label: 'Ta’lim tili',
        maxLength: 50,
        placeholder: 'O‘zbek',
    },
    {
        key: 'educationForm',
        label: 'Ta’lim shakli',
        maxLength: 50,
        placeholder: 'Kunduzgi',
    },
];

const TEACHER_FIELDS: FieldDefinition[] = [
    {
        key: 'employeeNumber',
        label: 'Tabel raqami',
        maxLength: 50,
        placeholder: 'EMP-001',
    },
    {
        key: 'position',
        label: 'Lavozimi',
        maxLength: 150,
        placeholder: 'Matematika fani o‘qituvchisi',
    },
    {
        key: 'employmentType',
        label: 'Ish turi',
        maxLength: 50,
        placeholder: 'Asosiy ish',
    },
    {
        key: 'qualificationCategory',
        label: 'Malaka toifasi',
        maxLength: 100,
        placeholder: 'Oliy toifa',
    },
    {
        key: 'specialization',
        label: 'Mutaxassisligi',
        maxLength: 150,
        placeholder: 'Matematika',
    },
    {
        key: 'educationLevel',
        label: 'Ma’lumoti',
        maxLength: 100,
        placeholder: 'Oliy',
    },
    {
        key: 'hireOrderNumber',
        label: 'Ishga qabul buyrug‘i',
        maxLength: 100,
        placeholder: '112-K',
    },
];

export function MembershipDetailsForm({
    membership,
    onSaved,
    onCancel,
}: {
    membership: SchoolMembership;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const isStudent = membership.type === 'STUDENT';

    const fields = isStudent
        ? STUDENT_FIELDS
        : TEACHER_FIELDS;

    const kind = isStudent
        ? 'students'
        : 'teachers';

    const path =
        `/membership-details/${kind}/${membership.id}`;

    const query = useApiQuery<DetailsResponse>(path);

    const [values, setValues] = useState<FieldValues>(
        EMPTY_VALUES,
    );

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        if (!query.data) return;

        const next: FieldValues = {
            ...EMPTY_VALUES,
        };

        for (const field of fields) {
            next[field.key] =
                query.data.details?.[field.key] ?? '';
        }

        setValues(next);
    }, [query.data, membership.type]);

    function changeValue(
        key: FieldKey,
        value: string,
    ) {
        setValues((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    async function save() {
        if (saving || !query.data) return;

        setSaving(true);
        setSaveError('');

        try {
            const payload: Record<string, string | null> = {};

            for (const field of fields) {
                const value = values[field.key].trim();

                payload[field.key] = value || null;
            }

            await authorizedPut(path, payload);

            onSaved();
        } catch (error: unknown) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : 'Ma’lumotlarni saqlab bo‘lmadi',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <form
            className="space-y-5"
            onSubmit={(event) => {
                event.preventDefault();
                void save();
            }}
        >
            {query.loading && (
                <LoadingState rows={4} />
            )}

            {query.error && (
                <ErrorState
                    message={query.error}
                    onRetry={query.retry}
                />
            )}

            {!query.loading &&
                !query.error &&
                query.data && (
                    <>
                        {!query.data.details && (
                            <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                                Hali qo‘shimcha ma’lumot kiritilmagan.
                                Quyidagi maydonlarni to‘ldirib saqlang.
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            {fields.map((field) => (
                                <Field
                                    key={field.key}
                                    htmlFor={`detail-${field.key}`}
                                    label={field.label}
                                >

                                    {isSelectField(field.key) ? (
                                        <SelectField
                                            id={`detail-${field.key}`}
                                            value={values[field.key]}
                                            onValueChange={(value) =>
                                                changeValue(field.key, value)
                                            }
                                            options={membershipOptions(
                                                field.key,
                                                values[field.key],
                                            )}
                                            emptyOption="Ko‘rsatilmagan"
                                            placeholder="Tanlang"
                                            disabled={saving}
                                        />
                                    ) : (
                                        <Input
                                            id={`detail-${field.key}`}
                                            value={values[field.key]}
                                            placeholder={field.placeholder}
                                            maxLength={field.maxLength}
                                            disabled={saving}
                                            onChange={(event) =>
                                                changeValue(
                                                    field.key,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    )}

                                </Field>
                            ))}
                        </div>

                        {saveError && (
                            <ErrorState message={saveError} />
                        )}

                        <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={saving}
                                onClick={onCancel}
                            >
                                Bekor qilish
                            </Button>

                            <Button
                                type="submit"
                                disabled={saving}
                            >
                                {saving
                                    ? 'Saqlanmoqda...'
                                    : 'Ma’lumotlarni saqlash'}
                            </Button>
                        </div>
                    </>
                )}
        </form>
    );
}
