import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ApiError } from '@/lib/api';
import { authorizedPatch, authorizedPost } from '@/lib/auth-session';
import type { CreatedSchool, CreateSchoolInput, School, UpdateSchoolInput } from '@/types/school';

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

function DistrictField({
    regionId,
    value,
    disabled,
    onChange,
}: {
    regionId: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const { data, loading, error, retry } = useApiQuery<DistrictOption[]>(`/districts?regionId=${encodeURIComponent(regionId)}`);
    const districts = data ?? [];

    return (
        <Field
            htmlFor={id}
            label={t('common.district')}
            required
            error={error || undefined}
            hint={!loading && !error && districts.length === 0 ? t('schools.form.noDistricts') : undefined}
        >
            <SelectField
                id={id}
                value={value}
                required
                disabled={disabled || loading || Boolean(error) || districts.length === 0}
                placeholder={loading ? t('common.loading') : t('schools.form.chooseDistrict')}
                onValueChange={onChange}
                options={districts.map((district) => ({ value: String(district.id), label: district.name }))}
            />
            {error && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={disabled}
                    onClick={() => {
                        onChange('');
                        retry();
                    }}
                >
                    {t('common.retry')}
                </Button>
            )}
        </Field>
    );
}

export function SchoolForm({ school, onSaved, onCancel }: SchoolFormProps) {
    const { t } = useTranslation();
    const formId = useId();

    const [name, setName] = useState(school?.name ?? '');
    const [regionId, setRegionId] = useState(school ? String(school.district.regionId) : '');
    const [districtId, setDistrictId] = useState(school ? String(school.districtId) : '');
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const submitting = useRef(false);
    const mounted = useRef(false);

    const { data: regions, loading: regionsLoading, error: regionsError, retry: retryRegions } = useApiQuery<RegionOption[]>('/regions');

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current) return;
        setSubmitError('');

        const trimmedName = name.trim();
        const nameLength = Array.from(trimmedName).length;
        const selectedDistrictId = Number(districtId);

        if (nameLength < 2 || nameLength > 200) return setSubmitError(t('schools.form.errors.nameLength'));
        if (!regionId || !districtId || !Number.isInteger(selectedDistrictId) || selectedDistrictId < 1 || selectedDistrictId > 4294967295) {
            return setSubmitError(t('schools.form.errors.location'));
        }

        const changes: UpdateSchoolInput = {};
        if (school) {
            if (trimmedName !== school.name) changes.name = trimmedName;
            if (selectedDistrictId !== school.districtId) changes.districtId = selectedDistrictId;
            if (Object.keys(changes).length === 0) return setSubmitError(t('schools.form.errors.noChanges'));
        }

        submitting.current = true;
        setBusy(true);
        let saved: CreatedSchool | undefined;

        try {
            if (school) {
                saved = await authorizedPatch<School>(`/schools/${school.id}`, changes);
            } else {
                const body: CreateSchoolInput = { name: trimmedName, districtId: selectedDistrictId };
                saved = await authorizedPost<CreatedSchool>('/schools', body);
            }
        } catch (error: unknown) {
            if (!mounted.current) return;
            if (error instanceof DOMException && error.name === 'AbortError') return;
            if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
                setSubmitError(t('schools.form.errors.uncertain'));
            } else {
                setSubmitError(error instanceof ApiError ? error.message : t('schools.form.errors.saveFailed'));
            }
        } finally {
            submitting.current = false;
            if (mounted.current) setBusy(false);
        }

        if (saved && mounted.current) onSaved(saved);
    }

    return (
        <form onSubmit={handleSubmit} aria-busy={busy} className="space-y-5">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field
                    htmlFor={`${formId}-region`}
                    label={t('common.region')}
                    required
                    error={regionsError || undefined}
                    hint={!regionsLoading && !regionsError && regions?.length === 0 ? t('schools.form.noRegions') : undefined}
                >
                    <SelectField
                        id={`${formId}-region`}
                        value={regionId}
                        required
                        disabled={busy || regionsLoading || Boolean(regionsError) || !regions?.length}
                        placeholder={regionsLoading ? t('common.loading') : t('persons.chooseRegion')}
                        onValueChange={(value) => {
                            setRegionId(value);
                            setDistrictId('');
                            setSubmitError('');
                        }}
                        options={(regions ?? []).map((region) => ({ value: String(region.id), label: region.name }))}
                    />
                    {regionsError && (
                        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={busy} onClick={retryRegions}>
                            {t('common.retry')}
                        </Button>
                    )}
                </Field>

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
                    <Field htmlFor={`${formId}-district`} label={t('common.district')} required>
                        <SelectField
                            id={`${formId}-district`}
                            value=""
                            onValueChange={() => undefined}
                            disabled
                            placeholder={t('schools.form.chooseRegionFirst')}
                            options={[]}
                        />
                    </Field>
                )}
            </div>

            <Field htmlFor={`${formId}-name`} label={t('schools.form.name')} hint={t('schools.form.nameHint')} required>
                <Input
                    id={`${formId}-name`}
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setSubmitError('');
                    }}
                    placeholder={t('schools.form.namePlaceholder')}
                    required
                    minLength={2}
                    maxLength={200}
                    disabled={busy}
                />
            </Field>

            {submitError && <ErrorState message={submitError} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy || !districtId || !regionId || regionsLoading || Boolean(regionsError)}>
                    {busy ? t('common.saving') : school ? t('schools.form.saveChanges') : t('schools.form.save')}
                </Button>
            </div>
        </form>
    );
}
