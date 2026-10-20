import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';

interface SchoolClass {
    id: number;
    name: string;
    academicYear: string;
}

interface Props {
    schoolId: number;
    academicYear: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    label?: string;
}

export function SchoolClassSelect({ schoolId, academicYear, value, onChange, disabled = false, label }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const params = new URLSearchParams({ schoolId: String(schoolId), academicYear });
    const query = useApiQuery<SchoolClass[]>(`/classes?${params.toString()}`);

    const empty = !query.loading && !query.error && query.data?.length === 0;

    return (
        <Field
            htmlFor={id}
            label={label ?? t('common.class')}
            required
            hint={empty ? t('members.noClasses') : undefined}
            error={query.error || undefined}
        >
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                required
                disabled={disabled || query.loading || Boolean(query.error) || !query.data?.length}
                placeholder={query.loading ? t('common.loading') : t('members.chooseClass')}
                options={(query.data ?? []).map((schoolClass) => ({
                    value: String(schoolClass.id),
                    label: schoolClass.name,
                }))}
            />
            {query.error && (
                <Button type="button" variant="outline" size="sm" className="w-fit" disabled={disabled} onClick={query.retry}>
                    {t('common.retry')}
                </Button>
            )}
        </Field>
    );
}
