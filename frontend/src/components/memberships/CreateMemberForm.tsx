import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ApiError } from '@/lib/api';
import {
    createPerson,
    findPersonByPnfl,
} from '@/lib/persons-api';
import { createSchoolMembership } from '@/lib/school-memberships-api';
import { ResidenceFields } from '@/components/persons/ResidenceFields';
import type { ResidenceValue } from '@/components/persons/ResidenceFields';
import { PersonPhoto } from '@/components/persons/PersonPhoto';
import { uploadPersonPhoto } from '@/lib/person-photos-api';

import type { Person } from '@/types/person';
import type { School } from '@/types/school';
import type { SchoolMembership } from '@/types/school-membership';

interface CreateMemberFormProps {
    type: SchoolMembership['type'];
    initialSchoolId?: number;
    onSaved: () => void;
    onCancel: () => void;
}

function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const get = (name: string) =>
        parts.find((part) => part.type === name)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
}

function personName(person: Person): string {
    return [
        person.lastName,
        person.firstName,
        person.middleName,
    ].filter(Boolean).join(' ');
}

export function CreateMemberForm({
    type,
    initialSchoolId,
    onSaved,
    onCancel,
}: CreateMemberFormProps) {

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoError, setPhotoError] = useState('');
    const id = useId();
    const mounted = useRef(false);
    const operationBusy = useRef(false);

    const [pnfl, setPnfl] = useState('');
    const [checked, setChecked] = useState(false);
    const [person, setPerson] = useState<Person | null>(null);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [gender, setGender] = useState<'' | 'MALE' | 'FEMALE'>('');
    const [birthDate, setBirthDate] = useState('');
    const [nationality, setNationality] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [residence, setResidence] = useState<ResidenceValue>({
        regionId: null,
        districtId: null,
        mahallaId: null,
    });
    const [endDate, setEndDate] = useState('');
    const [schoolId, setSchoolId] = useState(
        initialSchoolId ? String(initialSchoolId) : '',
    );
    const [startDate, setStartDate] = useState(todayInTashkent);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data ?? [];
    function isValidDate(value: string): boolean {
        if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(value)) {
            return false;
        }

        const date = new Date(`${value}T00:00:00.000Z`);

        return (
            !Number.isNaN(date.getTime()) &&
            date.toISOString().slice(0, 10) === value
        );
    }
    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    async function handleLookup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (operationBusy.current) return;

        if (!/^[0-9]{14}$/.test(pnfl)) {
            setError('PNFL aynan 14 ta raqamdan iborat bo‘lishi kerak.');
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

            setNotice(
                found
                    ? 'Shaxs topildi. Ma’lumotlarini tekshirib, maktabga biriktiring.'
                    : 'Shaxs topilmadi. Ism-familiyasini kiriting.',
            );
        } catch (lookupError: unknown) {
            if (!mounted.current) return;

            setError(
                lookupError instanceof ApiError
                    ? lookupError.message
                    : 'PNFLni tekshirib bo‘lmadi.',
            );
        } finally {
            operationBusy.current = false;

            if (mounted.current) setBusy(false);
        }
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (operationBusy.current || !checked) return;

        setError('');
        setNotice('');

        const selectedSchool = schools.find(
            (school) => String(school.id) === schoolId,
        );

        if (
            schoolsQuery.loading ||
            schoolsQuery.error ||
            !selectedSchool
        ) {
            setError('Ro‘yxatdan maktabni tanlang.');
            return;
        }

        if (!isValidDate(startDate)) {
            setError('Boshlanish sanasini to‘g‘ri kiriting.');
            return;
        }

        if (endDate) {
            if (!isValidDate(endDate)) {
                setError('Tugash sanasini to‘g‘ri kiriting.');
                return;
            }

            if (endDate <= startDate) {
                setError(
                    'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.',
                );
                return;
            }
        }

        const first = firstName.trim();
        const last = lastName.trim();
        const middle = middleName.trim();

        const normalizedNationality = nationality.trim();
        const normalizedPhone = phoneNumber.trim();
        const normalizedAddress = address.trim();

        if (!person) {
            if (
                Array.from(first).length < 1 ||
                Array.from(first).length > 100 ||
                Array.from(last).length < 1 ||
                Array.from(last).length > 100
            ) {
                setError('Ism va familiya 1–100 belgidan iborat bo‘lsin.');
                return;
            }

            if (Array.from(middle).length > 100) {
                setError('Otasining ismi 100 belgidan oshmasin.');
                return;
            }
            if (birthDate) {
                if (!isValidDate(birthDate)) {
                    setError('Tug‘ilgan sanani to‘g‘ri kiriting.');
                    return;
                }

                if (birthDate > todayInTashkent()) {
                    setError('Tug‘ilgan sana kelajakdagi sana bo‘lishi mumkin emas.');
                    return;
                }
            }

            if (Array.from(normalizedNationality).length > 100) {
                setError('Millati 100 belgidan oshmasin.');
                return;
            }

            if (
                normalizedPhone &&
                !/^\+[1-9][0-9]{7,14}$/.test(normalizedPhone)
            ) {
                setError(
                    'Telefon raqamini xalqaro formatda kiriting: +998901234567.',
                );
                return;
            }

            if (Array.from(normalizedAddress).length > 500) {
                setError('Yashash manzili 500 belgidan oshmasin.');
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
                    firstName: first,
                    lastName: last,
                    middleName: middle || null,
                    gender: gender || null,
                    birthDate: birthDate || null,
                    nationality: normalizedNationality || null,
                    phoneNumber: normalizedPhone || null,
                    address: normalizedAddress || null,
                    mahallaId: residence.mahallaId,
                });

                if (!mounted.current) return;

                // Biriktirish xato bersa, shu shaxsdan qayta foydalanamiz.
                setPerson(selectedPerson);
            }

            if (!mounted.current) return;
            if (!mounted.current) return;

            if (photoFile) {
                savingStage = 'photo';

                const uploaded = await uploadPersonPhoto(
                    selectedPerson.id,
                    photoFile,
                );

                if (!mounted.current) return;

                selectedPerson = {
                    ...selectedPerson,
                    photoUrl: uploaded.photoUrl,
                };

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

            if (
                saveError instanceof DOMException &&
                saveError.name === 'AbortError'
            ) {
                return;
            }

            if (
                !selectedPerson &&
                saveError instanceof ApiError &&
                (
                    saveError.status === 409 ||
                    saveError.status === 0 ||
                    saveError.status >= 500
                )
            ) {
                // Shaxs yaratilgan bo‘lishi mumkin.
                // Qayta POST qilishdan oldin PNFL bilan tekshiramiz.
                setChecked(false);

                setError(
                    savingStage === 'photo'
                        ? 'Rasm yuklash natijasini tasdiqlab bo‘lmadi. ' +
                        'Shaxs yozuvi mavjud, lekin bu urinishda maktabga ' +
                        'biriktirish hali bajarilmadi. Rasmni qayta yuklash mumkin.'
                        : 'Biriktirish natijasini tasdiqlab bo‘lmadi. ' +
                        'Formani yoping va ro‘yxatni yangilab tekshiring. ' +
                        'Shaxsni qaytadan yaratish shart emas.',
                );
            } else if (
                selectedPerson &&
                saveError instanceof ApiError &&
                (saveError.status === 0 || saveError.status >= 500)
            ) {
                setError(
                    'Biriktirish natijasini tasdiqlab bo‘lmadi. ' +
                    'Formani yoping va ro‘yxatni yangilab tekshiring. ' +
                    'Shaxsni qaytadan yaratish shart emas.',
                );
            } else {
                setError(
                    saveError instanceof ApiError
                        ? saveError.message
                        : 'Saqlashda xatolik yuz berdi.',
                );
            }
        } finally {
            operationBusy.current = false;

            if (mounted.current) setBusy(false);
        }

        if (completed && mounted.current) {
            onSaved();
        }
    }

    return (
        <div className="space-y-5" aria-busy={busy}>
            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive"
                >
                    {error}
                </p>
            )}

            {notice && (
                <p
                    role="status"
                    className="rounded-xl border bg-muted/30 p-4 text-sm leading-6"
                >
                    {notice}
                </p>
            )}

            {!checked ? (
                <form onSubmit={handleLookup} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor={`${id}-pnfl`}
                            className="text-sm font-medium"
                        >
                            PNFL — 14 ta raqam
                        </label>

                        <Input
                            id={`${id}-pnfl`}
                            value={pnfl}
                            onChange={(event) => {
                                setPnfl(
                                    event.target.value
                                        .replace(/[^0-9]/g, '')
                                        .slice(0, 14),
                                );
                                setError('');
                            }}
                            inputMode="numeric"
                            pattern="[0-9]{14}"
                            minLength={14}
                            maxLength={14}
                            autoComplete="off"
                            required
                            disabled={busy}
                            className="h-12 text-base sm:text-sm"
                        />
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={onCancel}
                            className="min-h-11"
                        >
                            Bekor qilish
                        </Button>

                        <Button
                            type="submit"
                            disabled={busy || pnfl.length !== 14}
                            className="min-h-11"
                        >
                            {busy ? 'Tekshirilmoqda…' : 'PNFLni tekshirish'}
                        </Button>
                    </div>
                </form>
            ) : (

                <form onSubmit={handleSave} className="space-y-5">
                    <div className="space-y-4 rounded-xl border p-4 sm:p-5">
                        <div>
                            <h3 className="text-sm font-semibold">
                                Profil rasmi — ixtiyoriy
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                JPEG, PNG yoki WebP. Ko‘pi bilan 5 MB.
                                Yuz aniq ko‘rinadigan rasm tanlang.
                            </p>
                        </div>

                        <PersonPhoto
                            {...(person ? { personId: person.id } : {})}
                            photoUrl={person?.photoUrl ?? null}
                            file={photoFile}
                            name={person ? personName(person) : 'Yangi shaxs'}
                        />

                        <div className="space-y-2">
                            <label
                                htmlFor={`${id}-photo`}
                                className="text-sm font-medium"
                            >
                                Rasm fayli
                            </label>

                            <input
                                id={`${id}-photo`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={busy}
                                aria-describedby={`${id}-photo-help`}
                                onChange={(event) => {
                                    const selected = event.target.files?.[0];

                                    // Bir xil faylni qayta tanlash ham ishlashi uchun.
                                    event.target.value = '';

                                    if (!selected) return;

                                    setPhotoError('');

                                    if (
                                        ![
                                            'image/jpeg',
                                            'image/png',
                                            'image/webp',
                                        ].includes(selected.type)
                                    ) {
                                        setPhotoError(
                                            'JPEG, PNG yoki WebP rasm tanlang.',
                                        );
                                        return;
                                    }

                                    if (selected.size > 5 * 1024 * 1024) {
                                        setPhotoError(
                                            'Rasm hajmi 5 MB dan oshmasin.',
                                        );
                                        return;
                                    }

                                    if (selected.size === 0) {
                                        setPhotoError('Tanlangan fayl bo‘sh.');
                                        return;
                                    }

                                    setPhotoFile(selected);
                                }}
                                className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border file:bg-muted file:px-3 file:py-2 file:text-foreground disabled:opacity-50"
                            />

                            <p
                                id={`${id}-photo-help`}
                                className="text-xs leading-5 text-muted-foreground"
                            >
                                Rasm asosiy saqlash tugmasi bosilganda yuklanadi.
                                Mavjud shaxs uchun yangi rasm eski rasm o‘rniga qo‘yiladi.
                            </p>
                        </div>

                        {photoFile && (
                            <div className="space-y-2">
                                <p className="text-xs [overflow-wrap:anywhere]">
                                    Tanlangan fayl: {photoFile.name}
                                </p>

                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                        setPhotoFile(null);
                                        setPhotoError('');
                                    }}
                                >
                                    Yangi rasm tanlovini bekor qilish
                                </Button>
                            </div>
                        )}

                        {photoError && (
                            <p role="alert" className="text-sm text-destructive">
                                {photoError}
                            </p>
                        )}
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs text-muted-foreground">PNFL</p>
                        <p className="mt-1 break-all font-medium">{pnfl}</p>

                        {person && (
                            <>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    Tanlangan shaxs
                                </p>
                                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                                    {[
                                        [
                                            'Jinsi',
                                            person.gender === 'MALE'
                                                ? 'Erkak'
                                                : person.gender === 'FEMALE'
                                                    ? 'Ayol'
                                                    : null,
                                        ],
                                        ['Tug‘ilgan sana', person.birthDate],
                                        ['Millati', person.nationality],
                                        ['Telefon', person.phoneNumber],
                                        ['Yashash manzili', person.address],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className={
                                                label === 'Yashash manzili'
                                                    ? 'min-w-0 md:col-span-2'
                                                    : 'min-w-0'
                                            }
                                        >
                                            <dt className="text-xs text-muted-foreground">
                                                {label}
                                            </dt>

                                            <dd className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">
                                                {value || 'Kiritilmagan'}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                                    Mavjud shaxsning ma’lumotlari ko‘rsatilmoqda.
                                    Maktabga biriktirish ushbu ma’lumotlarni o‘zgartirmaydi.
                                </p>
                                <p className="mt-1 font-medium [overflow-wrap:anywhere]">
                                    {personName(person)}
                                </p>
                            </>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            className="mt-4 min-h-11"
                            onClick={() => {
                                setChecked(false);
                                setPerson(null);
                                setFirstName('');
                                setLastName('');
                                setMiddleName('');
                                setGender('');
                                setBirthDate('');
                                setNationality('');
                                setPhoneNumber('');
                                setAddress('');
                                setResidence({
                                    regionId: null,
                                    districtId: null,
                                    mahallaId: null,
                                });
                                setEndDate('');
                                setError('');
                                setNotice('');
                            }}
                        >
                            Boshqa PNFL kiritish
                        </Button>
                    </div>

                    {!person && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor={`${id}-last`} className="text-sm font-medium">
                                    Familiyasi
                                </label>
                                <Input
                                    id={`${id}-last`}
                                    value={lastName}
                                    onChange={(event) => setLastName(event.target.value)}
                                    required
                                    maxLength={100}
                                    disabled={busy}
                                    className="h-12 text-base sm:text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor={`${id}-first`} className="text-sm font-medium">
                                    Ismi
                                </label>
                                <Input
                                    id={`${id}-first`}
                                    value={firstName}
                                    onChange={(event) => setFirstName(event.target.value)}
                                    required
                                    maxLength={100}
                                    disabled={busy}
                                    className="h-12 text-base sm:text-sm"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label htmlFor={`${id}-middle`} className="text-sm font-medium">
                                    Otasining ismi — ixtiyoriy
                                </label>
                                <Input
                                    id={`${id}-middle`}
                                    value={middleName}
                                    onChange={(event) => setMiddleName(event.target.value)}
                                    maxLength={100}
                                    disabled={busy}
                                    className="h-12 text-base sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label
                                    htmlFor={`${id}-gender`}
                                    className="text-sm font-medium"
                                >
                                    Jinsi — ixtiyoriy
                                </label>

                                <select
                                    id={`${id}-gender`}
                                    value={gender}
                                    onChange={(event) => {
                                        const value = event.target.value;

                                        setGender(
                                            value === 'MALE' || value === 'FEMALE'
                                                ? value
                                                : '',
                                        );
                                    }}
                                    disabled={busy}
                                    className="h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm"
                                >
                                    <option value="">Tanlang</option>
                                    <option value="MALE">Erkak</option>
                                    <option value="FEMALE">Ayol</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor={`${id}-birth`}
                                    className="text-sm font-medium"
                                >
                                    Tug‘ilgan sana — ixtiyoriy
                                </label>

                                <Input
                                    id={`${id}-birth`}
                                    type="date"
                                    value={birthDate}
                                    onChange={(event) => setBirthDate(event.target.value)}
                                    min="1000-01-01"
                                    max={todayInTashkent()}
                                    disabled={busy}
                                    className="h-12 w-full min-w-0 text-base sm:text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor={`${id}-nationality`}
                                    className="text-sm font-medium"
                                >
                                    Millati — ixtiyoriy
                                </label>

                                <Input
                                    id={`${id}-nationality`}
                                    value={nationality}
                                    onChange={(event) => setNationality(event.target.value)}
                                    placeholder="Masalan, o‘zbek"
                                    maxLength={100}
                                    disabled={busy}
                                    className="h-12 text-base sm:text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor={`${id}-phone`}
                                    className="text-sm font-medium"
                                >
                                    Telefon raqami — ixtiyoriy
                                </label>

                                <Input
                                    id={`${id}-phone`}
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(event) => setPhoneNumber(event.target.value)}
                                    placeholder="+998901234567"
                                    autoComplete="tel"
                                    maxLength={16}
                                    disabled={busy}
                                    aria-describedby={`${id}-phone-help`}
                                    className="h-12 text-base sm:text-sm"
                                />

                                <p
                                    id={`${id}-phone-help`}
                                    className="text-xs text-muted-foreground"
                                >
                                    + belgisi va raqamlar, bo‘sh joylarsiz.
                                </p>
                            </div>

                            <div className="md:col-span-2">
                                <ResidenceFields
                                    value={residence}
                                    onChange={setResidence}
                                    disabled={busy}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label
                                    htmlFor={`${id}-address`}
                                    className="text-sm font-medium"
                                >
                                    Yashash manzili — ixtiyoriy
                                </label>

                                <textarea
                                    id={`${id}-address`}
                                    value={address}
                                    onChange={(event) => setAddress(event.target.value)}
                                    placeholder="Ko‘cha va uy raqami"
                                    autoComplete="street-address"
                                    maxLength={500}
                                    rows={3}
                                    disabled={busy}
                                    className="w-full min-w-0 resize-y rounded-xl border bg-background px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor={`${id}-school`} className="text-sm font-medium">
                            Maktab
                        </label>

                        <select
                            id={`${id}-school`}
                            value={schoolId}
                            onChange={(event) => setSchoolId(event.target.value)}
                            required
                            disabled={
                                busy ||
                                schoolsQuery.loading ||
                                Boolean(schoolsQuery.error) ||
                                schools.length === 0
                            }
                            className="h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm"
                        >
                            <option value="">
                                {schoolsQuery.loading
                                    ? 'Yuklanmoqda…'
                                    : 'Maktabni tanlang'}
                            </option>

                            {schools.map((school) => (
                                <option key={school.id} value={school.id}>
                                    {school.name} — {school.district.name}
                                </option>
                            ))}
                        </select>

                        {schoolsQuery.error && (
                            <div role="alert" className="space-y-2">
                                <p className="text-sm text-destructive">
                                    {schoolsQuery.error}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={schoolsQuery.retry}
                                >
                                    Qayta urinish
                                </Button>
                            </div>
                        )}

                        {!schoolsQuery.loading &&
                            !schoolsQuery.error &&
                            schools.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Avval maktab yarating.
                                </p>
                            )}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor={`${id}-start`} className="text-sm font-medium">
                            {type === 'STUDENT'
                                ? 'O‘qish boshlangan sana'
                                : 'Ish boshlangan sana'}
                        </label>

                        <Input
                            id={`${id}-start`}
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            min="1000-01-01"
                            max="9999-12-31"
                            required
                            disabled={busy}
                            className="h-12 w-full min-w-0 text-base sm:text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor={`${id}-end`}
                            className="text-sm font-medium"
                        >
                            {type === 'STUDENT'
                                ? 'O‘qish tugash sanasi — ixtiyoriy'
                                : 'Ish tugash sanasi — ixtiyoriy'}
                        </label>

                        <Input
                            id={`${id}-end`}
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            min={startDate || '1000-01-01'}
                            max="9999-12-31"
                            disabled={busy}
                            aria-describedby={`${id}-end-help`}
                            className="h-12 w-full min-w-0 text-base sm:text-sm"
                        />

                        <p
                            id={`${id}-end-help`}
                            className="text-xs leading-5 text-muted-foreground"
                        >
                            Bu — biriktirish faol bo‘lmaydigan birinchi kun.
                            Tugash sanasi noma’lum bo‘lsa, bo‘sh qoldiring.
                        </p>
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={onCancel}
                            className="min-h-11"
                        >
                            Bekor qilish
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                busy ||
                                schoolsQuery.loading ||
                                Boolean(schoolsQuery.error) ||
                                !schools.some(
                                    (school) => String(school.id) === schoolId,
                                )
                            }
                            className="min-h-11"
                        >
                            {busy
                                ? 'Saqlanmoqda…'
                                : person
                                    ? 'Maktabga biriktirish'
                                    : 'Yaratish va biriktirish'}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}