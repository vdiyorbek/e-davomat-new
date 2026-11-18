import { useId } from 'react';
import { GraduationCap, Presentation } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { MAX_PERIOD_DAYS, PERIODS } from '@/lib/attendance-summary';
import type { Period, RangeError } from '@/lib/attendance-summary';
import { schoolScopeOptions } from '@/lib/school-scope';
import type { SummaryMembershipType } from '@/types/attendance-summary';
import type { School } from '@/types/school';
import type { SchoolClass } from '@/types/school-class';

export interface PlaceFilters {
    regionId: string;
    districtId: string;
    schoolId: string;
    classId: string;
}

interface Props {
    type: SummaryMembershipType;
    onTypeChange: (type: SummaryMembershipType) => void;
    period: Period;
    onPeriodChange: (period: Period) => void;
    from: string;
    to: string;
    today: string;
    onRangeChange: (from: string, to: string) => void;
    rangeError: RangeError | null;
    place: PlaceFilters;
    onPlaceChange: (patch: Partial<PlaceFilters>) => void;
    schools: School[] | null;
    schoolsLoading: boolean;
    academicYear: string;
}

/** Sinf tanlovi: faqat maktab tanlanganda yuklanadi. */
function ClassSelect({
    id,
    schoolId,
    academicYear,
    value,
    onChange,
}: {
    id: string;
    schoolId: string;
    academicYear: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const { data, loading, error } = useApiQuery<SchoolClass[]>(
        `/classes?schoolId=${encodeURIComponent(schoolId)}&academicYear=${encodeURIComponent(academicYear)}`,
    );

    const options = [...(data ?? [])]
        .sort(
            (a, b) =>
                (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99) || a.name.localeCompare(b.name, undefined, { numeric: true }),
        )
        .map((item) => ({ value: String(item.id), label: item.name }));

    return (
        <Field htmlFor={id} label={t('common.class')} error={error || undefined}>
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                disabled={loading || Boolean(error)}
                emptyOption={loading ? t('common.loading') : t('filters.allClasses')}
                options={options}
            />
        </Field>
    );
}

export function SummaryFilters({
    type,
    onTypeChange,
    period,
    onPeriodChange,
    from,
    to,
    today,
    onRangeChange,
    rangeError,
    place,
    onPlaceChange,
    schools,
    schoolsLoading,
    academicYear,
}: Props) {
    const { t } = useTranslation();
    const { session } = useAuth();
    const ids = useId();

    const role = session?.profile.role;
    const canSelectRegion = role === 'SUPER_ADMIN';
    const canSelectDistrict = canSelectRegion || role === 'REGION_ADMIN';
    const canSelectSchool = canSelectDistrict || role === 'DISTRICT_ADMIN';
    const students = type === 'STUDENT';

    // Maktab admini uchun maktab tanlanmaydi — o‘z maktabi.
    const classSchoolId = place.schoolId || (role === 'SCHOOL_ADMIN' && schools?.length === 1 ? String(schools[0].id) : '');

    const scope = schoolScopeOptions(schools, place.regionId, place.districtId);
    const placeCount = [canSelectRegion, canSelectDistrict, canSelectSchool, students].filter(Boolean).length;

    return (
        <section
            aria-label={t('common.filters')}
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
            {/* 1-qator: kimlar va davr */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <Tabs value={type} onValueChange={(value) => onTypeChange(value as SummaryMembershipType)}>
                    <TabsList aria-label={t('attendanceSummary.typeLabel')} className="w-full sm:w-fit">
                        <TabsTrigger value="STUDENT" className="px-4">
                            <GraduationCap aria-hidden="true" />
                            {t('attendanceSummary.type.STUDENT')}
                        </TabsTrigger>
                        <TabsTrigger value="TEACHER" className="px-4">
                            <Presentation aria-hidden="true" />
                            {t('attendanceSummary.type.TEACHER')}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_auto] sm:items-end">
                    <Field htmlFor={`${ids}-period`} label={t('attendanceSummary.period.label')}>
                        <SelectField
                            id={`${ids}-period`}
                            value={period}
                            onValueChange={(value) => onPeriodChange(value as Period)}
                            options={PERIODS.map((value) => ({
                                value,
                                label: t(`attendanceSummary.period.${value}`),
                            }))}
                        />
                    </Field>

                    {period === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                            <Field htmlFor={`${ids}-from`} label={t('attendanceSummary.from')}>
                                <Input
                                    id={`${ids}-from`}
                                    type="date"
                                    min="2000-01-01"
                                    max={today}
                                    value={from}
                                    onChange={(event) => onRangeChange(event.target.value, to)}
                                    aria-invalid={rangeError !== null}
                                />
                            </Field>
                            <Field htmlFor={`${ids}-to`} label={t('attendanceSummary.to')}>
                                <Input
                                    id={`${ids}-to`}
                                    type="date"
                                    min="2000-01-01"
                                    max={today}
                                    value={to}
                                    onChange={(event) => onRangeChange(from, event.target.value)}
                                    aria-invalid={rangeError !== null}
                                />
                            </Field>
                        </div>
                    )}
                </div>
            </div>

            {rangeError && (
                <p role="alert" className="text-sm font-medium text-destructive">
                    {t(`attendanceSummary.rangeErrors.${rangeError}`, { max: MAX_PERIOD_DAYS })}
                </p>
            )}

            {/* 2-qator: hudud */}
            {placeCount > 0 && (
                <div
                    className={
                        placeCount >= 3
                            ? 'grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4'
                            : 'grid gap-4 border-t pt-4 sm:grid-cols-2'
                    }
                >
                    {canSelectRegion && (
                        <Field htmlFor={`${ids}-region`} label={t('common.region')}>
                            <SelectField
                                id={`${ids}-region`}
                                value={place.regionId}
                                onValueChange={(value) =>
                                    onPlaceChange({ regionId: value, districtId: '', schoolId: '', classId: '' })
                                }
                                emptyOption={t('filters.allRegions')}
                                options={scope.regions}
                                disabled={schoolsLoading}
                            />
                        </Field>
                    )}

                    {canSelectDistrict && (
                        <Field htmlFor={`${ids}-district`} label={t('common.district')}>
                            <SelectField
                                id={`${ids}-district`}
                                value={place.districtId}
                                onValueChange={(value) => onPlaceChange({ districtId: value, schoolId: '', classId: '' })}
                                emptyOption={t('filters.allDistricts')}
                                options={scope.districts}
                                disabled={schoolsLoading}
                            />
                        </Field>
                    )}

                    {canSelectSchool && (
                        <Field htmlFor={`${ids}-school`} label={t('common.school')}>
                            <SelectField
                                id={`${ids}-school`}
                                value={place.schoolId}
                                onValueChange={(value) => onPlaceChange({ schoolId: value, classId: '' })}
                                emptyOption={t('filters.allSchools')}
                                options={scope.schools}
                                disabled={schoolsLoading}
                            />
                        </Field>
                    )}

                    {students &&
                        (classSchoolId ? (
                            <ClassSelect
                                key={`${classSchoolId}-${academicYear}`}
                                id={`${ids}-class`}
                                schoolId={classSchoolId}
                                academicYear={academicYear}
                                value={place.classId}
                                onChange={(value) => onPlaceChange({ classId: value })}
                            />
                        ) : (
                            <Field htmlFor={`${ids}-class`} label={t('common.class')}>
                                <SelectField
                                    id={`${ids}-class`}
                                    value=""
                                    onValueChange={() => undefined}
                                    disabled
                                    placeholder={t('filters.chooseSchoolFirst')}
                                    options={[]}
                                />
                            </Field>
                        ))}
                </div>
            )}
        </section>
    );
}
