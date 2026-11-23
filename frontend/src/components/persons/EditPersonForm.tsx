import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/common/states';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPut } from '@/lib/auth-session';
import { saveGuardians, updatePerson } from '@/lib/persons-api';
import { TeacherDetailsFields } from '@/components/memberships/TeacherDetailsFields';
import { sameTeacherDetails, teacherDetailsFromApi, teacherDetailsPayload } from '@/components/memberships/teacher-details';
import type { TeacherDetailsResponse, TeacherDetailsValue } from '@/components/memberships/teacher-details';
import type { Guardians, Person, UpdatePersonInput } from '@/types/person';

import { GuardianFields } from './GuardianFields';
import { PersonFields } from './PersonFields';
import { guardianPayload, guardiansFromApi, sameGuardian, validateGuardian } from './guardians';
import type { GuardiansValue } from './guardians';
import { validatePersonFields } from './person-fields';
import type { PersonFieldsValue } from './person-fields';

interface EditPersonFormProps {
    person: Person;
    /** O‘quvchi uchun ota-ona maydonlari ko‘rsatiladi. */
    withGuardians?: boolean;
    /** O‘qituvchi bo‘lsa — xodim ma’lumotlari ham shu oynada tahrirlanadi. */
    teacherMembershipId?: number | null;
    onSaved: () => void;
    onCancel: () => void;
}

function GuardiansLoader(props: EditPersonFormProps & { initialTeacher: TeacherDetailsValue | null }) {
    const query = useApiQuery<Guardians>(`/persons/${props.person.id}/guardians`);
    if (query.loading) return <LoadingState rows={4} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    return <EditPersonFormInner {...props} initialGuardians={guardiansFromApi(query.data)} />;
}

function TeacherLoader(props: EditPersonFormProps) {
    const query = useApiQuery<TeacherDetailsResponse>(`/membership-details/teachers/${props.teacherMembershipId}`);
    if (query.loading) return <LoadingState rows={4} />;
    if (query.error) return <ErrorState message={query.error} onRetry={query.retry} />;
    const initialTeacher = teacherDetailsFromApi(query.data);
    return props.withGuardians ? (
        <GuardiansLoader {...props} initialTeacher={initialTeacher} />
    ) : (
        <EditPersonFormInner {...props} initialGuardians={null} initialTeacher={initialTeacher} />
    );
}

export function EditPersonForm(props: EditPersonFormProps) {
    if (props.teacherMembershipId) return <TeacherLoader {...props} />;
    return props.withGuardians ? (
        <GuardiansLoader {...props} initialTeacher={null} />
    ) : (
        <EditPersonFormInner {...props} initialGuardians={null} initialTeacher={null} />
    );
}

function EditPersonFormInner({
    person,
    onSaved,
    onCancel,
    initialGuardians,
    initialTeacher,
    teacherMembershipId,
}: EditPersonFormProps & { initialGuardians: GuardiansValue | null; initialTeacher: TeacherDetailsValue | null }) {
    const { t } = useTranslation();
    const savingRef = useRef(false);

    const [fields, setFields] = useState<PersonFieldsValue>({
        lastName: person.lastName,
        firstName: person.firstName,
        middleName: person.middleName ?? '',
        gender: person.gender ?? '',
        birthDate: person.birthDate ?? '',
        nationality: person.nationality ?? '',
        phoneNumber: person.phoneNumber ?? '',
        address: person.address ?? '',
        residence: {
            regionId: person.mahalla?.district.regionId ?? null,
            districtId: person.mahalla?.districtId ?? null,
            mahallaId: person.mahallaId ?? null,
        },
    });
    const [guardians, setGuardians] = useState<GuardiansValue | null>(initialGuardians);
    const [teacher, setTeacher] = useState<TeacherDetailsValue | null>(initialTeacher);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (savingRef.current) return;
        setError('');

        const invalid = validatePersonFields(fields);
        if (invalid) {
            setError(t(invalid));
            return;
        }

        if (guardians) {
            const guardianError = validateGuardian(guardians.father) ?? validateGuardian(guardians.mother);
            if (guardianError) {
                setError(t(guardianError));
                return;
            }
        }

        const values = {
            firstName: fields.firstName.trim(),
            lastName: fields.lastName.trim(),
            middleName: fields.middleName.trim() || null,
            gender: fields.gender || null,
            birthDate: fields.birthDate || null,
            nationality: fields.nationality.trim() || null,
            phoneNumber: fields.phoneNumber.trim() || null,
            address: fields.address.trim() || null,
            mahallaId: fields.residence.mahallaId,
        } satisfies UpdatePersonInput;

        // Faqat o‘zgargan maydonlar yuboriladi.
        const changes: UpdatePersonInput = {};
        if (values.firstName !== person.firstName) changes.firstName = values.firstName;
        if (values.lastName !== person.lastName) changes.lastName = values.lastName;
        if (values.middleName !== person.middleName) changes.middleName = values.middleName;
        if (values.gender !== person.gender) changes.gender = values.gender;
        if (values.birthDate !== person.birthDate) changes.birthDate = values.birthDate;
        if (values.nationality !== person.nationality) changes.nationality = values.nationality;
        if (values.phoneNumber !== person.phoneNumber) changes.phoneNumber = values.phoneNumber;
        if (values.address !== person.address) changes.address = values.address;
        if (values.mahallaId !== (person.mahallaId ?? null)) changes.mahallaId = values.mahallaId;

        // Ota-ona: faqat o‘zgargani yuboriladi (bo‘sh qoldirilsa — o‘chiriladi).
        const guardianChanges: { father?: ReturnType<typeof guardianPayload>; mother?: ReturnType<typeof guardianPayload> } = {};
        if (guardians && initialGuardians) {
            if (!sameGuardian(guardians.father, initialGuardians.father)) guardianChanges.father = guardianPayload(guardians.father);
            if (!sameGuardian(guardians.mother, initialGuardians.mother)) guardianChanges.mother = guardianPayload(guardians.mother);
        }

        const teacherChanged = !!(teacher && initialTeacher && !sameTeacherDetails(teacher, initialTeacher));

        if (Object.keys(changes).length === 0 && Object.keys(guardianChanges).length === 0 && !teacherChanged) {
            setError(t('persons.errors.noChanges'));
            return;
        }

        savingRef.current = true;
        setBusy(true);
        try {
            if (Object.keys(changes).length > 0) await updatePerson(person.id, changes);
            if (Object.keys(guardianChanges).length > 0) await saveGuardians(person.id, guardianChanges);
            if (teacherChanged && teacher) {
                await authorizedPut(`/membership-details/teachers/${teacherMembershipId}`, teacherDetailsPayload(teacher));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('persons.errors.saveFailed'));
            return;
        } finally {
            savingRef.current = false;
            setBusy(false);
        }
        onSaved();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={busy} className="min-w-0">
                <PersonFields value={fields} onChange={setFields} disabled={busy} />
                {teacher && (
                    <div className="mt-6 border-t pt-5">
                        <h3 className="mb-4 text-sm font-semibold">{t('memberDetails.teacherTitle')}</h3>
                        <TeacherDetailsFields value={teacher} onChange={setTeacher} disabled={busy} />
                    </div>
                )}
                {guardians && (
                    <div className="mt-6 border-t pt-5">
                        <GuardianFields value={guardians} onChange={setGuardians} disabled={busy} />
                    </div>
                )}
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('common.save')}
                </Button>
            </div>
        </form>
    );
}
