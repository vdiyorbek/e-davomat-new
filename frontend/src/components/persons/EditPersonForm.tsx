import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePerson } from '@/lib/persons-api';

import type {
    Person,
    UpdatePersonInput,
} from '@/types/person';

interface EditPersonFormProps {
    person: Person;
    onSaved: () => void;
    onCancel: () => void;
}

function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
}

export function EditPersonForm({
    person,
    onSaved,
    onCancel,
}: EditPersonFormProps) {
    const formId = useId();
    const savingRef = useRef(false);

    const [firstName, setFirstName] = useState(person.firstName);
    const [lastName, setLastName] = useState(person.lastName);
    const [middleName, setMiddleName] = useState(
        person.middleName ?? '',
    );

    const [gender, setGender] = useState<
        'MALE' | 'FEMALE' | ''
    >(person.gender ?? '');

    const [birthDate, setBirthDate] = useState(
        person.birthDate ?? '',
    );
    const [nationality, setNationality] = useState(
        person.nationality ?? '',
    );
    const [phoneNumber, setPhoneNumber] = useState(
        person.phoneNumber ?? '',
    );
    const [address, setAddress] = useState(person.address ?? '');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (savingRef.current) return;

        setError('');

        const values = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim() || null,
            gender: gender || null,
            birthDate: birthDate || null,
            nationality: nationality.trim() || null,
            phoneNumber: phoneNumber.trim() || null,
            address: address.trim() || null,
        } satisfies UpdatePersonInput;

        if (!values.firstName || !values.lastName) {
            setError('Ism va familiyani kiriting.');
            return;
        }

        // Faqat o‘zgargan maydonlar yuboriladi.
        const changes: UpdatePersonInput = {};

        if (values.firstName !== person.firstName) {
            changes.firstName = values.firstName;
        }

        if (values.lastName !== person.lastName) {
            changes.lastName = values.lastName;
        }

        if (values.middleName !== person.middleName) {
            changes.middleName = values.middleName;
        }

        if (values.gender !== person.gender) {
            changes.gender = values.gender;
        }

        if (values.birthDate !== person.birthDate) {
            changes.birthDate = values.birthDate;
        }

        if (values.nationality !== person.nationality) {
            changes.nationality = values.nationality;
        }

        if (values.phoneNumber !== person.phoneNumber) {
            changes.phoneNumber = values.phoneNumber;
        }

        if (values.address !== person.address) {
            changes.address = values.address;
        }

        if (Object.keys(changes).length === 0) {
            setError('Ma’lumotlarda o‘zgarish yo‘q.');
            return;
        }

        savingRef.current = true;
        setBusy(true);

        try {
            await updatePerson(person.id, changes);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Ma’lumotlarni saqlab bo‘lmadi.',
            );
            return;
        } finally {
            savingRef.current = false;
            setBusy(false);
        }

        onSaved();
    }

    const textFields = [
        {
            name: 'lastName',
            label: 'Familiya',
            value: lastName,
            setValue: setLastName,
            required: true,
        },
        {
            name: 'firstName',
            label: 'Ism',
            value: firstName,
            setValue: setFirstName,
            required: true,
        },
        {
            name: 'middleName',
            label: 'Otasining ismi',
            value: middleName,
            setValue: setMiddleName,
            required: false,
        },
        {
            name: 'nationality',
            label: 'Millati',
            value: nationality,
            setValue: setNationality,
            required: false,
        },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                    {textFields.map((field) => (
                        <div key={field.name} className="space-y-2">
                            <label
                                htmlFor={`${formId}-${field.name}`}
                                className="text-sm font-medium"
                            >
                                {field.label}
                                {field.required ? ' *' : ''}
                            </label>

                            <Input
                                id={`${formId}-${field.name}`}
                                value={field.value}
                                onChange={(event) =>
                                    field.setValue(event.target.value)
                                }
                                required={field.required}
                                maxLength={100}
                            />
                        </div>
                    ))}

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-gender`}
                            className="text-sm font-medium"
                        >
                            Jinsi
                        </label>

                        <select
                            id={`${formId}-gender`}
                            value={gender}
                            onChange={(event) => {
                                const value = event.target.value;

                                setGender(
                                    value === 'MALE' || value === 'FEMALE'
                                        ? value
                                        : '',
                                );
                            }}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">Ko‘rsatilmagan</option>
                            <option value="MALE">Erkak</option>
                            <option value="FEMALE">Ayol</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor={`${formId}-birthDate`}
                            className="text-sm font-medium"
                        >
                            Tug‘ilgan sana
                        </label>

                        <Input
                            id={`${formId}-birthDate`}
                            type="date"
                            min="1000-01-01"
                            max={todayInTashkent()}
                            value={birthDate}
                            onChange={(event) =>
                                setBirthDate(event.target.value)
                            }
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label
                            htmlFor={`${formId}-phoneNumber`}
                            className="text-sm font-medium"
                        >
                            Telefon raqami
                        </label>

                        <Input
                            id={`${formId}-phoneNumber`}
                            type="tel"
                            placeholder="+998901234567"
                            value={phoneNumber}
                            onChange={(event) =>
                                setPhoneNumber(event.target.value)
                            }
                            pattern="\+[1-9][0-9]{7,14}"
                            maxLength={16}
                            title="Masalan: +998901234567"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label
                            htmlFor={`${formId}-address`}
                            className="text-sm font-medium"
                        >
                            Yashash manzili
                        </label>

                        <textarea
                            id={`${formId}-address`}
                            value={address}
                            onChange={(event) =>
                                setAddress(event.target.value)
                            }
                            maxLength={500}
                            rows={3}
                            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                </div>
            </fieldset>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                >
                    Bekor qilish
                </Button>

                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda…' : 'Saqlash'}
                </Button>
            </div>
        </form>
    );
}