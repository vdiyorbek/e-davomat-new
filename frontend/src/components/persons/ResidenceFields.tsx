import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/button';
import i18n from '@/i18n';
import { authorizedGet } from '@/lib/auth-session';

export interface ResidenceValue {
    regionId: number | null;
    districtId: number | null;
    mahallaId: number | null;
}

interface Option {
    id: number;
    name: string;
}

interface MahallasPage {
    data: Option[];
    totalPages: number;
}

interface OptionsState {
    path: string | null;
    items: Option[];
    loading: boolean;
    error: string;
}

function useAddressOptions(path: string | null, paginated = false) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<OptionsState>({ path: null, items: [], loading: false, error: '' });

    useEffect(() => {
        if (!path) return;
        const controller = new AbortController();
        setState({ path, items: [], loading: true, error: '' });

        async function load(): Promise<Option[]> {
            if (!paginated) return authorizedGet<Option[]>(path!, controller.signal);

            const items: Option[] = [];
            let page = 1;
            while (!controller.signal.aborted) {
                const result = await authorizedGet<MahallasPage>(`${path}&page=${page}&limit=100`, controller.signal);
                items.push(...result.data);
                if (page >= result.totalPages) break;
                page += 1;
            }
            return items;
        }

        void load()
            .then((items) => {
                if (controller.signal.aborted) return;
                setState({ path, items, loading: false, error: '' });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setState({
                    path,
                    items: [],
                    loading: false,
                    error: error instanceof Error ? error.message : i18n.t('common.loadFailed'),
                });
            });

        return () => controller.abort();
    }, [path, paginated, attempt]);

    // Avvalgi hududning ro‘yxatini yangi tanlovda ko‘rsatmaymiz.
    const current =
        path !== null && state.path === path ? state : { items: [], loading: path !== null, error: '' };

    return { ...current, retry: () => setAttempt((value) => value + 1) };
}

interface AddressSelectProps {
    label: string;
    placeholder: string;
    value: number | null;
    options: ReturnType<typeof useAddressOptions>;
    disabled: boolean;
    onChange: (value: number | null) => void;
}

function AddressSelect({ label, placeholder, value, options, disabled, onChange }: AddressSelectProps) {
    const { t } = useTranslation();
    const id = useId();

    return (
        <Field htmlFor={id} label={label} error={options.error || undefined}>
            <SelectField
                id={id}
                value={value === null ? '' : String(value)}
                onValueChange={(next) => onChange(next === '' ? null : Number(next))}
                disabled={disabled || options.loading || Boolean(options.error)}
                placeholder={options.loading ? t('common.loading') : placeholder}
                options={options.items.map((option) => ({ value: String(option.id), label: option.name }))}
            />
            {options.error && (
                <Button type="button" variant="outline" size="sm" className="w-fit" disabled={disabled} onClick={options.retry}>
                    {t('common.retry')}
                </Button>
            )}
        </Field>
    );
}

interface ResidenceFieldsProps {
    value: ResidenceValue;
    onChange: (value: ResidenceValue) => void;
    disabled?: boolean;
}

export function ResidenceFields({ value, onChange, disabled = false }: ResidenceFieldsProps) {
    const { t } = useTranslation();
    const regions = useAddressOptions('/regions/options');
    const districts = useAddressOptions(value.regionId ? `/districts/options?regionId=${value.regionId}` : null);
    const mahallas = useAddressOptions(
        value.districtId ? `/mahallas/options?districtId=${value.districtId}` : null,
        true,
    );

    return (
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
            <legend className="mb-3 text-sm font-semibold">{t('persons.residence')}</legend>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AddressSelect
                    label={t('common.region')}
                    placeholder={t('persons.chooseRegion')}
                    value={value.regionId}
                    options={regions}
                    disabled={disabled}
                    onChange={(regionId) => onChange({ regionId, districtId: null, mahallaId: null })}
                />
                <AddressSelect
                    label={t('common.district')}
                    placeholder={t('persons.chooseDistrict')}
                    value={value.districtId}
                    options={districts}
                    disabled={disabled || !value.regionId}
                    onChange={(districtId) => onChange({ ...value, districtId, mahallaId: null })}
                />
                <AddressSelect
                    label={t('persons.mahalla')}
                    placeholder={t('persons.chooseMahalla')}
                    value={value.mahallaId}
                    options={mahallas}
                    disabled={disabled || !value.districtId}
                    onChange={(mahallaId) => onChange({ ...value, mahallaId })}
                />
            </div>
        </fieldset>
    );
}
