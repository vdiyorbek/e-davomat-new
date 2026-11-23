import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Input } from '@/components/ui/input';

import { MEMBERSHIP_OPTIONS, membershipOptions, type MembershipSelectKey } from './membership-detail-options';
import { TEACHER_DETAIL_FIELDS } from './teacher-details';
import type { TeacherDetailKey, TeacherDetailsValue } from './teacher-details';

function isSelectKey(key: TeacherDetailKey): key is TeacherDetailKey & MembershipSelectKey {
    return key in MEMBERSHIP_OPTIONS;
}

/** Xodim ma’lumotlari maydonlari (boshqariladigan). Tahrirlash oynasida ishlatiladi. */
export function TeacherDetailsFields({
    value,
    onChange,
    disabled,
}: {
    value: TeacherDetailsValue;
    onChange: (next: TeacherDetailsValue) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {TEACHER_DETAIL_FIELDS.map((field) => (
                <Field key={field.key} htmlFor={`detail-${field.key}`} label={t(`memberDetails.fields.${field.key}`)}>
                    {isSelectKey(field.key) ? (
                        <SelectField
                            id={`detail-${field.key}`}
                            value={value[field.key]}
                            onValueChange={(next) => onChange({ ...value, [field.key]: next })}
                            options={membershipOptions(field.key, value[field.key], t)}
                            emptyOption={t('memberDetails.notSpecified')}
                            placeholder={t('memberDetails.choose')}
                            disabled={disabled}
                        />
                    ) : (
                        <Input
                            id={`detail-${field.key}`}
                            value={value[field.key]}
                            placeholder={
                                field.key === 'position' || field.key === 'specialization'
                                    ? t(`memberDetails.placeholders.${field.key}`)
                                    : field.placeholder
                            }
                            maxLength={field.maxLength}
                            disabled={disabled}
                            onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                        />
                    )}
                </Field>
            ))}
        </div>
    );
}
