import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { Input } from '@/components/ui/input';

interface Props {
    lastName: string;
    firstName: string;
    middleName: string;
    onChange: (field: 'lastName' | 'firstName' | 'middleName', value: string) => void;
    disabled?: boolean;
}

export function UserNameFields({ lastName, firstName, middleName, onChange, disabled }: Props) {
    const { t } = useTranslation();
    const id = useId();

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <Field htmlFor={`${id}-last`} label={t('common.lastName')} required>
                <Input
                    id={`${id}-last`}
                    value={lastName}
                    onChange={(event) => onChange('lastName', event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                    disabled={disabled}
                    autoComplete="family-name"
                />
            </Field>
            <Field htmlFor={`${id}-first`} label={t('common.firstName')} required>
                <Input
                    id={`${id}-first`}
                    value={firstName}
                    onChange={(event) => onChange('firstName', event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                    disabled={disabled}
                    autoComplete="given-name"
                />
            </Field>
            <Field htmlFor={`${id}-middle`} label={t('common.middleName')}>
                <Input
                    id={`${id}-middle`}
                    value={middleName}
                    onChange={(event) => onChange('middleName', event.target.value)}
                    maxLength={100}
                    disabled={disabled}
                    autoComplete="additional-name"
                />
            </Field>
        </div>
    );
}
