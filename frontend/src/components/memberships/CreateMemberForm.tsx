import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageUp, RotateCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { FileInput } from '@/components/common/FileInput';
import { validateFacePhoto } from '@/lib/face-photo-validation';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { PersonFields } from '@/components/persons/PersonFields';
import { EMPTY_PERSON_FIELDS, isValidDate, validatePersonFields } from '@/components/persons/person-fields';
import type { PersonFieldsValue } from '@/components/persons/person-fields';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { PersonSchools } from '@/components/persons/PersonSchools';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ApiError } from '@/lib/api';
import { formatDate, todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import { uploadPersonPhoto } from '@/lib/person-photos-api';
import { createPerson, findPersonByPnfl } from '@/lib/persons-api';
import { createSchoolMembership } from '@/lib/school-memberships-api';
import type { Person } from '@/types/person';
import type { School } from '@/types/school';
import type { SchoolMembership } from '@/types/school-membership';

interface CreateMemberFormProps {
    type: SchoolMembership['type'];
    initialSchoolId?: number;
    onSaved: () => void;
    onCancel: () => void;
}

export function CreateMemberForm({ type, initialSchoolId, onSaved, onCancel }: CreateMemberFormProps) {
    const { t } = useTranslation();
    const id = useId();
    const mounted = useRef(false);
    const operationBusy = useRef(false);

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoError, setPhotoError] = useState('');
    const photoSelectionId = useRef(0);
    const [photoChecking, setPhotoChecking] = useState(false);
    const [pnfl, setPnfl] = useState('');
    const [checked, setChecked] = useState(false);
    const [person, setPerson] = useState<Person | null>(null);
    const [fields, setFields] = useState<PersonFieldsValue>(EMPTY_PERSON_FIELDS);

    const [schoolId, setSchoolId] = useState(initialSchoolId ? String(initialSchoolId) : '');
    const [startDate, setStartDate] = useState(todayInTashkent);
    const [endDate, setEndDate] = useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data ?? [];
    const kind = type === 'STUDENT' ? 'student' : 'teacher';

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    function resetPerson() {
        setChecked(false);
        setPerson(null);
        setFields(EMPTY_PERSON_FIELDS);
        setEndDate('');
        setError('');
        setNotice('');
    }

    async function handlePhotoSelect(selected: File | null) {
        const currentSelection = ++photoSelectionId.current;

        setPhotoError('');
        setPhotoFile(null);

        if (!selected) {
            setPhotoChecking(false);
            return;
        }

        setPhotoChecking(true);

        try {
            const result = await validateFacePhoto(selected);

            if (currentSelection !== photoSelectionId.current) return;

            if (!result.valid) {
                setPhotoError(
                    result.error ?? 'Rasm talabga javob bermaydi.',
                );
                return;
            }

            setPhotoFile(selected);
        } finally {
            if (currentSelection === photoSelectionId.current) {
                setPhotoChecking(false);
            }
        }
    }

    async function handleLookup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (operationBusy.current) return;

        if (!/^[0-9]{14}$/.test(pnfl)) {
            setError(t('common.pnflInvalid'));
            return;
        }

        operationBusy.current = true;
        setBusy(true);
        setError('');
        setNotice('');

        try {
            const found = await findPersonByPnfl(pnfl);
            if (!mounted.current) return;
            setPerson(found);
            setChecked(true);
            setNotice(found ? t('members.create.found') : t('members.create.notFound'));
        } catch (lookupError: unknown) {
            if (!mounted.current) return;
            setError(lookupError instanceof ApiError ? lookupError.message : t('members.create.lookupFailed'));
        } finally {
            operationBusy.current = false;
            if (mounted.current) setBusy(false);
        }
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (operationBusy.current || !checked || photoChecking) return;

        setError('');
        setNotice('');

        const selectedSchool = schools.find((school) => String(school.id) === schoolId);
        if (schoolsQuery.loading || schoolsQuery.error || !selectedSchool) {
            setError(t('members.errors.chooseSchool'));
            return;
        }
        if (!isValidDate(startDate)) {
            setError(t('members.errors.startDate'));
            return;
        }
        if (endDate) {
            if (!isValidDate(endDate)) {
                setError(t('members.errors.endDate'));
                return;
            }
            if (endDate <= startDate) {
                setError(t('members.end.errorBeforeStart'));
                return;
            }
        }

        if (!person) {
            const invalid = validatePersonFields(fields);
            if (invalid) {
                setError(t(invalid));
                return;
            }
        }

        operationBusy.current = true;
        setBusy(true);

        let selectedPerson = person;
        let completed = false;
        let savingStage: 'person' | 'photo' | 'membership' = 'person';

        try {
            if (!selectedPerson) {
                selectedPerson = await createPerson({
                    pnfl,
                    firstName: fields.firstName.trim(),
                    lastName: fields.lastName.trim(),
                    middleName: fields.middleName.trim() || null,
                    gender: fields.gender || null,
                    birthDate: fields.birthDate || null,
                    nationality: fields.nationality.trim() || null,
                    phoneNumber: fields.phoneNumber.trim() || null,
                    address: fields.address.trim() || null,
                    mahallaId: fields.residence.mahallaId,
                });
                if (!mounted.current) return;
                // Biriktirish xato bersa, shu shaxsdan qayta foydalanamiz.
                setPerson(selectedPerson);
            }

            if (!mounted.current) return;

            if (photoFile) {
                savingStage = 'photo';
                const uploaded = await uploadPersonPhoto(selectedPerson.id, photoFile);
                if (!mounted.current) return;
                selectedPerson = { ...selectedPerson, photoUrl: uploaded.photoUrl };
                setPerson(selectedPerson);
                setPhotoFile(null);
                setPhotoError('');
            }

            savingStage = 'membership';
            await createSchoolMembership({
                personId: selectedPerson.id,
                schoolId: selectedSchool.id,
                type,
                startDate,
                endDate: endDate || null,
            });
            completed = true;
        } catch (saveError: unknown) {
            if (!mounted.current) return;
            if (saveError instanceof DOMException && saveError.name === 'AbortError') return;

            const uncertain =
                saveError instanceof ApiError && (saveError.status === 0 || saveError.status >= 500);

            if (!selectedPerson && saveError instanceof ApiError && (saveError.status === 409 || uncertain)) {
                // Shaxs yaratilgan bo‘lishi mumkin. Qayta POST qilishdan oldin PNFL bilan tekshiramiz.
                setChecked(false);
                setError(savingStage === 'photo' ? t('members.create.photoUncertain') : t('members.create.uncertain'));
            } else if (selectedPerson && uncertain) {
                setError(t('members.create.uncertain'));
            } else {
                setError(saveError instanceof ApiError ? saveError.message : t('members.create.saveFailed'));
            }
        } finally {
            operationBusy.current = false;
            if (mounted.current) setBusy(false);
        }

        if (completed && mounted.current) onSaved();
    }

    const messages = (
        <>
            {error && <ErrorState message={error} />}
            {notice && (
                <Alert>
                    <AlertDescription className="text-foreground">{notice}</AlertDescription>
                </Alert>
            )}
        </>
    );

    if (!checked) {
        return (
            <form onSubmit={handleLookup} className="space-y-5" aria-busy={busy}>
                {messages}
                <Field htmlFor={`${id}-pnfl`} label={t('common.pnfl')} hint={t('members.create.pnflHint')} required>
                    <Input
                        id={`${id}-pnfl`}
                        value={pnfl}
                        onChange={(event) => {
                            setPnfl(event.target.value.replace(/[^0-9]/g, '').slice(0, 14));
                            setError('');
                        }}
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        minLength={14}
                        maxLength={14}
                        autoComplete="off"
                        placeholder="00000000000000"
                        required
                        disabled={photoChecking || busy}
                        className="font-mono tracking-wider tabular-nums"
                    />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={busy || pnfl.length !== 14}>
                        <Search aria-hidden="true" />
                        {busy ? t('members.create.checking') : t('members.create.check')}
                    </Button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6" aria-busy={busy}>
            {messages}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('common.pnfl')}</p>
                    <p className="font-mono font-semibold tracking-wider break-all">{pnfl}</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={resetPerson}>
                    <RotateCcw aria-hidden="true" />
                    {t('members.create.otherPnfl')}
                </Button>
            </div>

            {person ? (
                <section className="space-y-4 rounded-xl border p-4">
                    <div>
                        <p className="text-xs text-muted-foreground">{t('members.create.selectedPerson')}</p>
                        <p className="mt-1 text-base font-semibold [overflow-wrap:anywhere]">{personFullName(person)}</p>
                    </div>
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                        {[
                            { label: t('persons.gender'), value: person.gender ? t(`persons.genders.${person.gender}`) : null },
                            { label: t('persons.birthDate'), value: person.birthDate ? formatDate(person.birthDate) : null },
                            { label: t('persons.nationality'), value: person.nationality },
                            { label: t('persons.phone'), value: person.phoneNumber },
                            { label: t('persons.address'), value: person.address, wide: true },
                        ].map((item) => (
                            <div key={item.label} className={item.wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
                                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                                <dd className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">
                                    {item.value || <span className="text-muted-foreground">{t('profile.notEntered')}</span>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <PersonSchools key={person.id} personId={person.id} />
                    <p className="text-xs leading-5 text-muted-foreground">{t('members.create.existingNote')}</p>
                </section>
            ) : (
                <section className="space-y-4">
                    <h3 className="font-heading text-base font-semibold">{t('members.create.personDetails')}</h3>
                    <PersonFields value={fields} onChange={setFields} disabled={busy} />
                </section>
            )}

            <section className="space-y-4 rounded-xl border p-4">
                <div>
                    <h3 className="text-sm font-semibold">{t('members.create.photoTitle')}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('members.create.photoHint', { size: 5 })}</p>
                </div>
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <PersonPhoto
                        {...(person ? { personId: person.id } : {})}
                        photoUrl={person?.photoUrl ?? null}
                        file={photoFile}
                        name={person ? personFullName(person) : t('members.create.newPerson')}
                        className="size-24"
                    />
                    <div className="w-full min-w-0 flex-1 space-y-2">
                        <FileInput
                            id={`${id}-photo`}
                            accept="image/jpeg,image/png,image/webp"
                            file={photoFile}
                            disabled={busy || photoChecking}
                            icon={<ImageUp aria-hidden="true" />}
                            buttonLabel={t('photo.choose')}
                            onFileChange={(selected) => {
                                void handlePhotoSelect(selected);
                            }}
                        />
                        <p className="text-xs leading-5 text-muted-foreground">{t('members.create.photoUploadNote')}</p>
                        {photoError && (
                            <p role="alert" className="text-sm text-destructive">
                                {photoError}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h3 className="font-heading text-base font-semibold">{t('members.create.membershipTitle')}</h3>
                <Field
                    htmlFor={`${id}-school`}
                    label={t('common.school')}
                    required
                    error={schoolsQuery.error || undefined}
                    hint={!schoolsQuery.loading && !schoolsQuery.error && schools.length === 0 ? t('members.create.noSchools') : undefined}
                >
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={setSchoolId}
                        required
                        searchable
                        disabled={busy || schoolsQuery.loading || Boolean(schoolsQuery.error) || schools.length === 0}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        options={schools.map((school) => ({
                            value: String(school.id),
                            label: `${school.name} — ${school.district.name}`,
                        }))}
                    />
                    {schoolsQuery.error && (
                        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={busy} onClick={schoolsQuery.retry}>
                            {t('common.retry')}
                        </Button>
                    )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor={`${id}-start`} label={t(`members.create.${kind}Start`)} required>
                        <Input
                            id={`${id}-start`}
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            min="1900-01-01"
                            max="9999-12-31"
                            required
                            disabled={busy}
                        />
                    </Field>
                    <Field htmlFor={`${id}-end`} label={t(`members.create.${kind}End`)} hint={t('members.create.endHint')}>
                        <Input
                            id={`${id}-end`}
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            min={startDate || '1900-01-01'}
                            max="9999-12-31"
                            disabled={busy}
                        />
                    </Field>
                </div>
            </section>

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button
                    type="submit"
                    disabled={
                        busy ||
                        schoolsQuery.loading ||
                        Boolean(schoolsQuery.error) ||
                        !schools.some((school) => String(school.id) === schoolId)
                    }
                >
                    {busy
                        ? t('common.saving')
                        : person
                            ? t('members.create.attach')
                            : t('members.create.createAndAttach')}
                </Button>
            </div>
        </form>
    );
}
