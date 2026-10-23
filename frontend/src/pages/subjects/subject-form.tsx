import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { Input } from '@/components/ui/input';

export interface Subject {
    id: number;
    code: string;
    nameUz: string;
    nameRu: string | null;
    isActive: boolean;
}

export interface SubjectValues {
    code: string;
    nameUz: string;
    nameRu: string;
}

export function SubjectFields({
    idPrefix,
    values,
    onChange,
    disabled,
}: {
    idPrefix: string;
    values: SubjectValues;
    onChange: (values: SubjectValues) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <Field htmlFor={`${idPrefix}-code`} label={t('subjects.code')} hint={t('subjects.codeHint')} required>
                <Input
                    id={`${idPrefix}-code`}
                    value={values.code}
                    onChange={(event) => onChange({ ...values, code: event.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    placeholder="MATEMATIKA"
                    maxLength={40}
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="font-mono"
                    disabled={disabled}
                    required
                />
            </Field>
            <Field htmlFor={`${idPrefix}-uz`} label={t('subjects.nameUz')} required>
                <Input
                    id={`${idPrefix}-uz`}
                    value={values.nameUz}
                    onChange={(event) => onChange({ ...values, nameUz: event.target.value })}
                    placeholder="Matematika"
                    maxLength={150}
                    disabled={disabled}
                    required
                />
            </Field>
            <Field htmlFor={`${idPrefix}-ru`} label={`${t('subjects.nameRu')} (${t('common.optional')})`}>
                <Input
                    id={`${idPrefix}-ru`}
                    value={values.nameRu}
                    onChange={(event) => onChange({ ...values, nameRu: event.target.value })}
                    placeholder="Математика"
                    maxLength={150}
                    disabled={disabled}
                />
            </Field>
        </div>
    );
}
