import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { updatePerson } from '@/lib/persons-api';
import type { Person, UpdatePersonInput } from '@/types/person';

import { PersonFields } from './PersonFields';
import { validatePersonFields } from './person-fields';
import type { PersonFieldsValue } from './person-fields';

interface EditPersonFormProps {
    person: Person;
    onSaved: () => void;
    onCancel: () => void;
}

export function EditPersonForm({ person, onSaved, onCancel }: EditPersonFormProps) {
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

        if (Object.keys(changes).length === 0) {
            setError(t('persons.errors.noChanges'));
            return;
        }

        savingRef.current = true;
        setBusy(true);
        try {
            await updatePerson(person.id, changes);
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
