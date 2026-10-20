import { useState } from 'react';
import { ArrowLeft, Camera, Pencil } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { ChangePersonPhoto } from '@/components/persons/ChangePersonPhoto';
import { EditPersonForm } from '@/components/persons/EditPersonForm';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { PersonSchools } from '@/components/persons/PersonSchools';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { Person } from '@/types/person';

function PersonDetails({ personId }: { personId: number }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { session } = useAuth();
    const [searchParams] = useSearchParams();
    const { data: person, loading, error, retry } = useApiQuery<Person>(`/persons/${personId}`);

    const [editing, setEditing] = useState(() => searchParams.get('edit') === '1');
    const [changingPhoto, setChangingPhoto] = useState(false);
    const [success, setSuccess] = useState('');

    const canEdit = session?.profile.role === 'SUPER_ADMIN';

    const backButton = (
        <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" />
            {t('common.back')}
        </Button>
    );

    if (loading) return <LoadingState rows={6} />;

    if (error || !person) {
        return (
            <div className="space-y-4">
                <ErrorState message={error || t('persons.notFound')} onRetry={retry} />
                {backButton}
            </div>
        );
    }

    const fullName = personFullName(person);
    const notSet = t('common.notSet');

    const details: { label: string; value: string | null; wide?: boolean }[] = [
        { label: t('common.pnfl'), value: person.pnfl },
        { label: t('persons.gender'), value: person.gender ? t(`persons.genders.${person.gender}`) : null },
        { label: t('persons.birthDate'), value: person.birthDate ? formatDate(person.birthDate) : null },
        { label: t('persons.nationality'), value: person.nationality },
        { label: t('persons.phone'), value: person.phoneNumber },
        { label: t('common.region'), value: person.mahalla?.district.region.name ?? null },
        { label: t('common.district'), value: person.mahalla?.district.name ?? null },
        { label: t('persons.mahalla'), value: person.mahalla?.name ?? null },
        { label: t('persons.address'), value: person.address, wide: true },
    ];

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <PageHeader title={t('persons.title')} description={t('persons.subtitle')} actions={backButton} />

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <Card className="gap-0 py-0">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
                    <PersonPhoto personId={person.id} photoUrl={person.photoUrl} name={fullName} />
                    <div className="min-w-0 flex-1">
                        <h2 className="font-heading text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl">{fullName}</h2>
                        <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                            {t('common.pnfl')}: {person.pnfl}
                        </p>
                    </div>
                    {canEdit && (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                            <Button
                                onClick={() => {
                                    setSuccess('');
                                    setEditing(true);
                                }}
                            >
                                <Pencil aria-hidden="true" />
                                {t('common.edit')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSuccess('');
                                    setChangingPhoto(true);
                                }}
                            >
                                <Camera aria-hidden="true" />
                                {t('photo.change')}
                            </Button>
                        </div>
                    )}
                </div>
                <Separator />
                <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                    {details.map((item) => (
                        <div key={item.label} className={item.wide ? 'min-w-0 sm:col-span-2 lg:col-span-3' : 'min-w-0'}>
                            <dt className="text-xs text-muted-foreground">{item.label}</dt>
                            <dd className="mt-1 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">
                                {item.value || <span className="font-normal text-muted-foreground">{notSet}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('persons.schools.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <PersonSchools key={person.id} personId={person.id} allowClassChange />
                </CardContent>
            </Card>

            {canEdit && (
                <>
                    <Dialog open={editing} onOpenChange={setEditing}>
                        <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>{t('persons.editTitle')}</DialogTitle>
                                <DialogDescription>{fullName}</DialogDescription>
                            </DialogHeader>
                            <EditPersonForm
                                person={person}
                                onCancel={() => setEditing(false)}
                                onSaved={() => {
                                    setEditing(false);
                                    setSuccess(t('persons.saved'));
                                    retry();
                                }}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={changingPhoto} onOpenChange={setChangingPhoto}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('photo.change')}</DialogTitle>
                                <DialogDescription>{fullName}</DialogDescription>
                            </DialogHeader>
                            <ChangePersonPhoto
                                personId={person.id}
                                photoUrl={person.photoUrl}
                                name={fullName}
                                onCancel={() => setChangingPhoto(false)}
                                onSaved={() => {
                                    setChangingPhoto(false);
                                    setSuccess(t('persons.photoSaved'));
                                    retry();
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}

export function PersonDetailsPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const personId = Number(id);
    const valid = /^[1-9][0-9]*$/.test(id ?? '') && Number.isSafeInteger(personId) && personId <= 4294967295;

    if (!valid) return <ErrorState message={t('persons.invalidId')} />;

    return <PersonDetails key={personId} personId={personId} />;
}
