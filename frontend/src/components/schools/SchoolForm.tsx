import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ApiError } from '@/lib/api';

import { authorizedPost, authorizedPatch } from '@/lib/auth-session';
import type { School, CreatedSchool, CreateSchoolInput, UpdateSchoolInput } from '@/types/school';



interface RegionOption {
    id: number;
    name: string;
}

interface DistrictOption {
    id: number;
    name: string;
    regionId: number;
}

interface SchoolFormProps {
    school?: School;
    onSaved: (school: CreatedSchool) => void;
    onCancel: () => void;
}

interface DistrictFieldProps {
    regionId: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}

const selectClassName =
    'h-12 w-full min-w-0 rounded-xl border bg-background px-3 ' +
    'text-base text-foreground outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-ring ' +
    'disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

function DistrictField({
    regionId,
    value,
    disabled,
    onChange,
}: DistrictFieldProps) {
    const id = useId();

    const { data, loading, error, retry } =
        useApiQuery<DistrictOption[]>(
            `/districts?regionId=${encodeURIComponent(regionId)}`,
        );

    const districts = data ?? [];

    return (
        <div className="min-w-0 space-y-2">
            <label htmlFor={id} className="text-sm font-medium">
                Tuman / shahar
            </label>

            <select
                id={id}
                value={value}
                required
                disabled={
                    disabled ||
                    loading ||
                    Boolean(error) ||
                    districts.length === 0
                }
                className={selectClassName}
                onChange={(event) => {
                    const next = event.target.value;

                    const exists = districts.some(
                        (district) => String(district.id) === next,
                    );

                    onChange(exists ? next : '');
                }}
            >
                <option value="">
                    {loading
                        ? 'Yuklanmoqda…'
                        : 'Tuman yoki shaharni tanlang'}
                </option>

                {districts.map((district) => (
                    <option
                        key={district.id}
                        value={district.id}
                    >
                        {district.name}
                    </option>
                ))}
            </select>

            {error && (
                <div role="alert" className="space-y-2">
                    <p className="text-sm text-destructive">
                        {error}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => {
                            onChange('');
                            retry();
                        }}
                    >
                        Qayta urinish
                    </Button>
                </div>
            )}

            {!loading && !error && districts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Ushbu viloyatda tuman yoki shahar topilmadi.
                </p>
            )}
        </div>
    );
}

export function SchoolForm({
    school,
    onSaved,
    onCancel
}: SchoolFormProps) {
    const formId = useId();

    const [name, setName] = useState(school?.name ?? '');
    const [regionId, setRegionId] = useState(school ? String(school.district.regionId) : '');
    const [districtId, setDistrictId] = useState(school ? String(school.districtId) : '');
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const submitting = useRef(false);
    const mounted = useRef(false);

    const {
        data: regions,
        loading: regionsLoading,
        error: regionsError,
        retry: retryRegions,
    } = useApiQuery<RegionOption[]>('/regions');

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (submitting.current) return;

        setSubmitError('');

        const trimmedName = name.trim();
        const nameLength = Array.from(trimmedName).length;
        const selectedDistrictId = Number(districtId);

        if (nameLength < 2 || nameLength > 200) {
            setSubmitError(
                'Maktab nomi 2–200 belgidan iborat bo‘lishi kerak.',
            );
            return;
        }

        if (
            !regionId ||
            !districtId ||
            !Number.isInteger(selectedDistrictId) ||
            selectedDistrictId < 1 ||
            selectedDistrictId > 4294967295
        ) {
            setSubmitError('Viloyat va tumanni tanlang.');
            return;
        }

        const changes: UpdateSchoolInput = {};

        if (school) {
            if (trimmedName !== school.name) {
                changes.name = trimmedName;
            }

            if (selectedDistrictId !== school.districtId) {
                changes.districtId = selectedDistrictId;
            }

            if (Object.keys(changes).length === 0) {
                setSubmitError('Hali hech qanday o‘zgarish kiritilmadi.');
                return;
            }
        }

        submitting.current = true;
        setBusy(true);

        let saved: CreatedSchool | undefined;

        try {
            if (school) {
                saved = await authorizedPatch<School>(
                    `/schools/${school.id}`,
                    changes,
                );
            } else {
                const body: CreateSchoolInput = {
                    name: trimmedName,
                    districtId: selectedDistrictId,
                };

                saved = await authorizedPost<CreatedSchool>(
                    '/schools',
                    body,
                );
            }
        } catch (error: unknown) {
            if (!mounted.current) return;

            if (
                error instanceof DOMException &&
                error.name === 'AbortError'
            ) {
                return;
            }

            if (
                error instanceof ApiError &&
                (error.status === 0 || error.status >= 500)
            ) {
                setSubmitError(
                    'Saqlash natijasini tasdiqlab bo‘lmadi. ' +
                    'Qayta yuborishdan oldin formani yoping va ' +
                    'maktablar ro‘yxatini yangilab tekshiring.',
                );
            } else {
                setSubmitError(
                    error instanceof ApiError
                        ? error.message
                        : 'Maktabni saqlashda xatolik yuz berdi.',
                );
            }
        } finally {
            submitting.current = false;

            if (mounted.current) {
                setBusy(false);
            }
        }

        if (saved && mounted.current) {
            onSaved(saved);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            aria-busy={busy}
            className="space-y-5"
        >
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                    <label
                        htmlFor={`${formId}-region`}
                        className="text-sm font-medium"
                    >
                        Viloyat
                    </label>

                    <select
                        id={`${formId}-region`}
                        value={regionId}
                        required
                        disabled={
                            busy ||
                            regionsLoading ||
                            Boolean(regionsError) ||
                            !regions?.length
                        }
                        className={selectClassName}
                        onChange={(event) => {
                            setRegionId(event.target.value);
                            setDistrictId('');
                            setSubmitError('');
                        }}
                    >
                        <option value="">
                            {regionsLoading
                                ? 'Yuklanmoqda…'
                                : 'Viloyatni tanlang'}
                        </option>

                        {regions?.map((region) => (
                            <option key={region.id} value={region.id}>
                                {region.name}
                            </option>
                        ))}
                    </select>

                    {regionsError && (
                        <div role="alert" className="space-y-2">
                            <p className="text-sm text-destructive">
                                {regionsError}
                            </p>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={retryRegions}
                            >
                                Qayta urinish
                            </Button>
                        </div>
                    )}

                    {!regionsLoading &&
                        !regionsError &&
                        regions?.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Avval tizimga viloyat qo‘shish kerak.
                            </p>
                        )}
                </div>

                {regionId ? (
                    <DistrictField
                        key={regionId}
                        regionId={regionId}
                        value={districtId}
                        disabled={busy}
                        onChange={(value) => {
                            setDistrictId(value);
                            setSubmitError('');
                        }}
                    />
                ) : (
                    <div className="min-w-0 space-y-2">
                        <label
                            htmlFor={`${formId}-district`}
                            className="text-sm font-medium"
                        >
                            Tuman / shahar
                        </label>

                        <select
                            id={`${formId}-district`}
                            disabled
                            className={selectClassName}
                        >
                            <option>Avval viloyatni tanlang</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label
                    htmlFor={`${formId}-name`}
                    className="text-sm font-medium"
                >
                    Maktab nomi
                </label>

                <Input
                    id={`${formId}-name`}
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setSubmitError('');
                    }}
                    placeholder="Masalan, Termiz shahar 1-son politexnikumi"
                    required
                    minLength={2}
                    maxLength={200}
                    disabled={busy}
                    aria-describedby={`${formId}-name-help`}
                    className="h-12 rounded-xl text-base sm:text-sm"
                />

                <p
                    id={`${formId}-name-help`}
                    className="text-xs text-muted-foreground"
                >
                    Maktabning to‘liq nomini kiriting. 2–200 belgi.
                </p>
            </div>

            {submitError && (
                <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive"
                >
                    {submitError}
                </p>
            )}

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
                        !districtId ||
                        !regionId ||
                        regionsLoading ||
                        Boolean(regionsError)
                    }
                    className="min-h-11"
                >
                    {busy
                        ? 'Saqlanmoqda…'
                        : school
                            ? 'O‘zgarishlarni saqlash'
                            : 'Maktabni saqlash'}
                </Button>
            </div>
        </form>
    );
}