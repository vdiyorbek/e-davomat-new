import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { EditPersonForm } from '@/components/persons/EditPersonForm';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ChangePersonPhoto } from '@/components/persons/ChangePersonPhoto';
import { PersonSchools } from '@/components/persons/PersonSchools';

import type { Person } from '@/types/person';

function formatDate(value: string | null): string {
    if (!value) return 'Ko‘rsatilmagan';

    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
}

function PersonDetails({ personId }: { personId: number }) {
    const navigate = useNavigate();
    const { session } = useAuth();
    const [changingPhoto, setChangingPhoto] = useState(false);
    const [searchParams] = useSearchParams();
    const { data: person, loading, error, retry } =
        useApiQuery<Person>(`/persons/${personId}`);

    const [editing, setEditing] = useState(
        () => searchParams.get('edit') === '1',
    );
    const [success, setSuccess] = useState('');

    const canEdit = session?.profile.role === 'SUPER_ADMIN';

    if (loading) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                Ma’lumotlar yuklanmoqda…
            </p>
        );
    }

    if (error || !person) {
        return (
            <div className="space-y-4">
                <p role="alert" className="text-sm text-destructive">
                    {error || 'Shaxs ma’lumotlari topilmadi.'}
                </p>

                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        Orqaga
                    </Button>

                    <Button onClick={retry}>
                        Qayta urinish
                    </Button>
                </div>
            </div>
        );
    }

    const fullName = [
        person.lastName,
        person.firstName,
        person.middleName,
    ].filter(Boolean).join(' ');

    const details = [
        { label: 'PNFL', value: person.pnfl },
        { label: 'Familiya', value: person.lastName },
        { label: 'Ism', value: person.firstName },
        { label: 'Otasining ismi', value: person.middleName },
        {
            label: 'Jinsi',
            value:
                person.gender === 'MALE'
                    ? 'Erkak'
                    : person.gender === 'FEMALE'
                        ? 'Ayol'
                        : null,
        },
        {
            label: 'Tug‘ilgan sana',
            value: formatDate(person.birthDate),
        },
        { label: 'Millati', value: person.nationality },
        { label: 'Telefon raqami', value: person.phoneNumber },
        {
            label: 'Yashash viloyati',
            value: person.mahalla?.district.region.name ?? null,
        },
        {
            label: 'Yashash tumani / shahri',
            value: person.mahalla?.district.name ?? null,
        },
        {
            label: 'Mahalla',
            value: person.mahalla?.name ?? null,
        },
        { label: 'Yashash manzili', value: person.address },
    ];

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Shaxs ma’lumotlari
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        O‘quvchi yoki o‘qituvchining shaxsiy ma’lumotlari.
                    </p>
                </div>

                <Button
                    variant="outline"
                    className="self-start"
                    onClick={() => navigate(-1)}
                >
                    Orqaga
                </Button>
            </div>

            {success && (
                <p
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
                >
                    {success}
                </p>
            )}

            <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
                <div className="flex flex-col gap-5 border-b p-5 sm:flex-row sm:items-center sm:p-6">
                    <div className="shrink-0">
                        <PersonPhoto
                            personId={person.id}
                            photoUrl={person.photoUrl}
                            name={fullName}
                        />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h2 className="break-words text-xl font-semibold">
                            {fullName}
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground">
                            PNFL: {person.pnfl}
                        </p>
                    </div>

                    {canEdit && !editing && !changingPhoto && (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                            <Button
                                onClick={() => {
                                    setSuccess('');
                                    setEditing(true);
                                }}
                            >
                                Tahrirlash
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSuccess('');
                                    setChangingPhoto(true);
                                }}
                            >
                                Rasmni almashtirish
                            </Button>
                        </div>
                    )}
                </div>

                <div className="p-5 sm:p-6">
                    {changingPhoto && canEdit && (
                        <div className="mb-6">
                            <ChangePersonPhoto
                                personId={person.id}
                                photoUrl={person.photoUrl}
                                name={fullName}
                                onCancel={() => setChangingPhoto(false)}
                                onSaved={() => {
                                    setChangingPhoto(false);
                                    setSuccess('Profil rasmi yangilandi.');
                                    retry();
                                }}
                            />
                        </div>
                    )}
                    {editing && canEdit ? (
                        <EditPersonForm
                            person={person}
                            onCancel={() => setEditing(false)}
                            onSaved={() => {
                                setEditing(false);
                                setSuccess(
                                    'Shaxs ma’lumotlari saqlandi.',
                                );
                                retry();
                            }}
                        />
                    ) : (
                        <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                            {details.map((item) => (
                                <div
                                    key={item.label}
                                    className={
                                        item.label === 'Yashash manzili'
                                            ? 'min-w-0 md:col-span-2'
                                            : 'min-w-0'
                                    }
                                >
                                    <dt className="text-sm text-muted-foreground">
                                        {item.label}
                                    </dt>

                                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
                                        {item.value || 'Ko‘rsatilmagan'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </section>
            <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <PersonSchools
                    key={person.id}
                    personId={person.id}
                    allowClassChange
                />
            </section>
        </div>
    );
}

export function PersonDetailsPage() {
    const { id } = useParams();

    const personId = Number(id);
    const valid =
        /^[1-9][0-9]*$/.test(id ?? '') &&
        Number.isSafeInteger(personId) &&
        personId <= 4294967295;

    if (!valid) {
        return (
            <p role="alert" className="text-sm text-destructive">
                Shaxs identifikatori noto‘g‘ri.
            </p>
        );
    }

    return <PersonDetails key={personId} personId={personId} />;
}
