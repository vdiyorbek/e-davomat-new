import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/common/SelectField';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ApiError } from '@/lib/api';
import { authorizedPost } from '@/lib/auth-session';

import type {
    CreatedSchool,
    CreateSchoolInput,
} from '@/types/school';

interface RegionOption {
    id: number;
    name: string;
}

interface DistrictOption {
    id: number;
    name: string;
    regionId: number;
}

interface CreateSchoolFormProps {
    onCreated: (school: CreatedSchool) => void;
    onCancel: () => void;
}

interface DistrictFieldProps {
    regionId: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}

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
            <Label htmlFor={id}>
                Tuman / shahar
            </Label>

            <SelectField
                id={id}
                value={value}
                required
                disabled={
                    disabled ||
                    loading ||
                    Boolean(error) ||
                    districts.length === 0
                }
                placeholder={
                    loading ? 'Yuklanmoqda…' : 'Tuman yoki shaharni tanlang'
                }
                options={districts.map((district) => ({
                    value: String(district.id),
                    label: district.name,
                }))}
                onValueChange={(next) => {
                    const exists = districts.some(
                        (district) => String(district.id) === next,
                    );

                    onChange(exists ? next : '');
                }}
            />

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

export function CreateSchoolForm({
    onCreated,
    onCancel,
}: CreateSchoolFormProps) {
    const formId = useId();

    const [name, setName] = useState('');
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
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

        const body: CreateSchoolInput = {
            name: trimmedName,
            districtId: selectedDistrictId,
        };

        submitting.current = true;
        setBusy(true);

        let created: CreatedSchool | undefined;

        try {
            created = await authorizedPost<CreatedSchool>(
                '/schools',
                body,
            );
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

        if (created && mounted.current) {
            onCreated(created);
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
                    <Label
                        htmlFor={`${formId}-region`}>
                        Viloyat
                    </Label>

                    <SelectField
                        id={`${formId}-region`}
                        value={regionId}
                        required
                        disabled={
                            busy ||
                            regionsLoading ||
                            Boolean(regionsError) ||
                            !regions?.length
                        }
                        placeholder={
                            regionsLoading ? 'Yuklanmoqda…' : 'Viloyatni tanlang'
                        }
                        options={(regions ?? []).map((region) => ({
                            value: String(region.id),
                            label: region.name,
                        }))}
                        onValueChange={(next) => {
                            setRegionId(next);
                            setDistrictId('');
                            setSubmitError('');
                        }}
                    />

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
                        <Label
                            htmlFor={`${formId}-district`}>
                            Tuman / shahar
                        </Label>

                        <SelectField
                            id={`${formId}-district`}
                            value=""
                            disabled
                            placeholder="Avval viloyatni tanlang"
                            options={[]}
                            onValueChange={() => undefined}
                        />
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label
                    htmlFor={`${formId}-name`}>
                    Maktab nomi
                </Label>

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
                    {busy ? 'Saqlanmoqda…' : 'Maktabni saqlash'}
                </Button>
            </div>
        </form>
    );
}