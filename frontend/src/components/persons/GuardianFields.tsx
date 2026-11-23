import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { Input } from '@/components/ui/input';

import type { GuardianValue, GuardiansValue } from './guardians';

interface Props {
    value: GuardiansValue;
    onChange: (value: GuardiansValue) => void;
    disabled?: boolean;
    /** Yangi o‘quvchi: kamida bitta ota yoki ona majburiy ekanini ko‘rsatadi. */
    requiredHint?: boolean;
}

function One({
    title,
    value,
    onChange,
    disabled,
}: {
    title: string;
    value: GuardianValue;
    onChange: (value: GuardianValue) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const id = useId();
    const set = (key: keyof GuardianValue, next: string) => onChange({ ...value, [key]: next });

    return (
        <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
                <Field htmlFor={`${id}-last`} label={t('common.lastName')}>
                    <Input
                        id={`${id}-last`}
                        value={value.lastName}
                        onChange={(event) => set('lastName', event.target.value)}
                        maxLength={100}
                        disabled={disabled}
                    />
                </Field>
                <Field htmlFor={`${id}-first`} label={t('common.firstName')}>
                    <Input
                        id={`${id}-first`}
                        value={value.firstName}
                        onChange={(event) => set('firstName', event.target.value)}
                        maxLength={100}
                        disabled={disabled}
                    />
                </Field>
                <Field htmlFor={`${id}-middle`} label={t('common.middleName')}>
                    <Input
                        id={`${id}-middle`}
                        value={value.middleName}
                        onChange={(event) => set('middleName', event.target.value)}
                        maxLength={100}
                        disabled={disabled}
                    />
                </Field>
            </div>
            <Field htmlFor={`${id}-phone`} label={t('persons.phone')} hint={t('persons.phoneHint')}>
                <Input
                    id={`${id}-phone`}
                    type="tel"
                    inputMode="tel"
                    value={value.phoneNumber}
                    onChange={(event) => set('phoneNumber', event.target.value.replace(/[^\d+]/g, ''))}
                    placeholder="+998901234567"
                    autoComplete="off"
                    maxLength={16}
                    disabled={disabled}
                    className="sm:max-w-xs"
                />
            </Field>
        </fieldset>
    );
}

/** Ota va ona: familiya, ism, otasining ismi va telefon. */
export function GuardianFields({ value, onChange, disabled, requiredHint }: Props) {
    const { t } = useTranslation();
    return (
        <section className="space-y-3">
            <div>
                <h3 className="text-sm font-semibold">
                    {t('persons.guardians.title')}
                    {requiredHint && <span aria-hidden="true" className="ml-1 text-destructive">*</span>}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {requiredHint ? t('persons.guardians.requiredHint') : t('persons.guardians.hint')}
                </p>
            </div>
            <div className="grid gap-4">
                <One title={t('persons.guardians.father')} value={value.father} onChange={(father) => onChange({ ...value, father })} disabled={disabled} />
                <One title={t('persons.guardians.mother')} value={value.mother} onChange={(mother) => onChange({ ...value, mother })} disabled={disabled} />
            </div>
        </section>
    );
}
