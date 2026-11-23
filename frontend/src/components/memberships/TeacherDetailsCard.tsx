import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';

import { TEACHER_DETAIL_FIELDS, type TeacherDetailsResponse } from './teacher-details';

/** O‘qituvchining xodim ma’lumotlari (ko‘rish). Tahrirlash — shaxs tahrirlash oynasida. */
export function TeacherDetailsCard({ membershipId }: { membershipId: number }) {
    const { t } = useTranslation();
    const query = useApiQuery<TeacherDetailsResponse>(`/membership-details/teachers/${membershipId}`);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold">{t('memberDetails.teacherTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                {query.loading && <LoadingState rows={2} />}
                {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
                {!query.loading && !query.error && query.data && (
                    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                        {TEACHER_DETAIL_FIELDS.map((field) => {
                            const raw = query.data?.details?.[field.key] ?? '';
                            const isOption = ['employmentType', 'qualificationCategory', 'educationLevel'].includes(field.key);
                            const shown = raw && isOption ? t(`memberDetails.options.${field.key}.${raw}`, { defaultValue: raw }) : raw;
                            return (
                                <div key={field.key} className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{t(`memberDetails.fields.${field.key}`)}</dt>
                                    <dd className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">
                                        {shown || <span className="font-normal text-muted-foreground">{t('common.notSet')}</span>}
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                )}
            </CardContent>
        </Card>
    );
}
