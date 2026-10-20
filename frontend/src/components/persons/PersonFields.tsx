import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { todayInTashkent } from '@/lib/date';

import { ResidenceFields } from './ResidenceFields';
import type { PersonFieldsValue } from './person-fields';

interface PersonFieldsProps {
    value: PersonFieldsValue;
    onChange: (value: PersonFieldsValue) => void;
    disabled?: boolean;
}

/** Shaxsning shaxsiy ma’lumotlari: yaratish va tahrirlash formalarida umumiy. */
export function PersonFields({ value, onChange, disabled = false }: PersonFieldsProps) {
    const { t } = useTranslation();
    const id = useId();

    function set<K extends keyof PersonFieldsValue>(key: K, next: PersonFieldsValue[K]) {
        onChange({ ...value, [key]: next });
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor={`${id}-last`} label={t('common.lastName')} required>
                <Input
                    id={`${id}-last`}
                    value={value.lastName}
                    onChange={(event) => set('lastName', event.target.value)}
                    required
                    maxLength={100}
                    autoComplete="family-name"
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-first`} label={t('common.firstName')} required>
                <Input
                    id={`${id}-first`}
                    value={value.firstName}
                    onChange={(event) => set('firstName', event.target.value)}
                    required
                    maxLength={100}
                    autoComplete="given-name"
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-middle`} label={t('common.middleName')}>
                <Input
                    id={`${id}-middle`}
                    value={value.middleName}
                    onChange={(event) => set('middleName', event.target.value)}
                    maxLength={100}
                    autoComplete="additional-name"
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-gender`} label={t('persons.gender')}>
                <SelectField
                    id={`${id}-gender`}
                    value={value.gender}
                    onValueChange={(next) => set('gender', next === 'MALE' || next === 'FEMALE' ? next : '')}
                    emptyOption={t('persons.genderNotSet')}
                    options={[
                        { value: 'MALE', label: t('persons.genders.MALE') },
                        { value: 'FEMALE', label: t('persons.genders.FEMALE') },
                    ]}
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-birth`} label={t('persons.birthDate')}>
                <Input
                    id={`${id}-birth`}
                    type="date"
                    value={value.birthDate}
                    onChange={(event) => set('birthDate', event.target.value)}
                    min="1900-01-01"
                    max={todayInTashkent()}
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-nationality`} label={t('persons.nationality')}>
                <Input
                    id={`${id}-nationality`}
                    value={value.nationality}
                    onChange={(event) => set('nationality', event.target.value)}
                    placeholder={t('persons.nationalityPlaceholder')}
                    maxLength={100}
                    disabled={disabled}
                />
            </Field>
            <Field htmlFor={`${id}-phone`} label={t('persons.phone')} hint={t('persons.phoneHint')} className="md:col-span-2">
                <Input
                    id={`${id}-phone`}
                    type="tel"
                    inputMode="tel"
                    value={value.phoneNumber}
                    onChange={(event) => set('phoneNumber', event.target.value.replace(/[^\d+]/g, ''))}
                    placeholder="+998901234567"
                    autoComplete="tel"
                    maxLength={16}
                    disabled={disabled}
                    className="md:max-w-sm"
                />
            </Field>
            <div className="md:col-span-2">
                <ResidenceFields value={value.residence} onChange={(next) => set('residence', next)} disabled={disabled} />
            </div>
            <Field htmlFor={`${id}-address`} label={t('persons.address')} className="md:col-span-2">
                <Textarea
                    id={`${id}-address`}
                    value={value.address}
                    onChange={(event) => set('address', event.target.value)}
                    placeholder={t('persons.addressPlaceholder')}
                    autoComplete="street-address"
                    maxLength={500}
                    rows={3}
                    disabled={disabled}
                />
            </Field>
        </div>
    );
}
