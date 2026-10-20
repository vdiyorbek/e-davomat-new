import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { academicYearFor, addDays, todayInTashkent } from '@/lib/date';
import { schoolScopeOptions } from '@/lib/school-scope';
import { cn } from '@/lib/utils';
import type { School } from '@/types/school';

export interface AttendanceFilterValues {
    date: string;
    regionId: string;
    districtId: string;
    schoolId: string;
    classId: string;
    attendanceStatus: string;
    search: string;
    pnfl: string;
}

interface Props {
    values: AttendanceFilterValues;
    onApply: (values: AttendanceFilterValues) => void;
    mode?: 'students' | 'teachers';
}

interface SchoolClassOption {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
}

function ClassFilter({
    id,
    schoolId,
    date,
    value,
    onChange,
}: {
    id: string;
    schoolId: string;
    date: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const path = `/classes?schoolId=${encodeURIComponent(schoolId)}&academicYear=${encodeURIComponent(academicYearFor(date))}`;
    const { data: classes, loading, error, retry } = useApiQuery<SchoolClassOption[]>(path);

    return (
        <Field htmlFor={id} label={t('common.class')} error={error || undefined}>
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                disabled={loading || Boolean(error)}
                emptyOption={loading ? t('common.loading') : t('filters.allClasses')}
                options={(classes ?? []).map((schoolClass) => ({ value: String(schoolClass.id), label: schoolClass.name }))}
            />
            {error && (
                <Button type="button" size="sm" variant="outline" className="w-fit" onClick={retry}>
                    {t('common.retry')}
                </Button>
            )}
        </Field>
    );
}

const STUDENT_STATUSES = ['inside', 'left', 'excused', 'absent'] as const;
const TEACHER_STATUSES = ['inside', 'left', 'absent'] as const;

export function AttendanceFilters({ values, onApply, mode = 'students' }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [draft, setDraft] = useState<AttendanceFilterValues>(values);
    const { data: schools, loading, error, retry } = useApiQuery<School[]>('/schools');

    const advancedCount = [values.regionId, values.districtId, values.schoolId, values.classId, values.pnfl].filter(Boolean).length;
    const [expanded, setExpanded] = useState(advancedCount > 0);

    const scope = schoolScopeOptions(schools, draft.regionId, draft.districtId);
    const today = todayInTashkent();

    function update<K extends keyof AttendanceFilterValues>(key: K, value: AttendanceFilterValues[K]) {
        setDraft((previous) => ({ ...previous, [key]: value }));
    }

    function apply(next: AttendanceFilterValues) {
        onApply({
            ...next,
            classId: mode === 'teachers' ? '' : next.classId,
            search: next.search.trim(),
            pnfl: next.pnfl.trim(),
        });
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        apply(draft);
    }

    function clearFilters() {
        const cleared: AttendanceFilterValues = {
            date: draft.date,
            regionId: '',
            districtId: '',
            schoolId: '',
            classId: '',
            attendanceStatus: '',
            search: '',
            pnfl: '',
        };
        setDraft(cleared);
        onApply(cleared);
    }

    function shiftDate(days: number) {
        const next = addDays(draft.date, days);
        if (next > today) return;
        const updated = { ...draft, date: next, classId: '' };
        setDraft(updated);
        apply(updated);
    }

    const statuses = mode === 'teachers' ? TEACHER_STATUSES : STUDENT_STATUSES;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            {/* Asosiy qator: sana, holat, qidiruv */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <Field htmlFor={`${id}-date`} label={t('common.date')}>
                    <div className="flex gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 shrink-0 bg-card"
                            aria-label={t('attendance.prevDay')}
                            onClick={() => shiftDate(-1)}
                        >
                            <ChevronLeft aria-hidden="true" />
                        </Button>
                        <Input
                            id={`${id}-date`}
                            type="date"
                            required
                            min="2000-01-01"
                            max={today}
                            value={draft.date}
                            onChange={(event) => setDraft((previous) => ({ ...previous, date: event.target.value, classId: '' }))}
                            className="min-w-0"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 shrink-0 bg-card"
                            aria-label={t('attendance.nextDay')}
                            disabled={draft.date >= today}
                            onClick={() => shiftDate(1)}
                        >
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </Field>

                <Field htmlFor={`${id}-status`} label={t('attendance.statusLabel')}>
                    <SelectField
                        id={`${id}-status`}
                        value={draft.attendanceStatus}
                        onValueChange={(value) => update('attendanceStatus', value)}
                        emptyOption={t('filters.allStatuses')}
                        options={statuses.map((status) => ({ value: status, label: t(`attendance.status.${status}`) }))}
                    />
                </Field>

                <Field htmlFor={`${id}-search`} label={t('attendance.searchByName')} className="sm:col-span-2 xl:col-span-1">
                    <div className="relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id={`${id}-search`}
                            type="search"
                            value={draft.search}
                            minLength={2}
                            maxLength={100}
                            placeholder={t('attendance.searchPlaceholder')}
                            onChange={(event) => update('search', event.target.value)}
                            className="pl-10"
                        />
                    </div>
                </Field>

                <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1 bg-card xl:flex-none"
                        aria-expanded={expanded}
                        aria-controls={`${id}-advanced`}
                        onClick={() => setExpanded((value) => !value)}
                    >
                        <Filter aria-hidden="true" />
                        {expanded ? t('filters.showLess') : t('filters.showMore')}
                        {advancedCount > 0 && (
                            <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                                {advancedCount}
                            </span>
                        )}
                    </Button>
                    <Button type="submit" className="h-11 flex-1 xl:flex-none" disabled={loading || Boolean(error)}>
                        {t('attendance.show')}
                    </Button>
                </div>
            </div>

            {/* Kengaytirilgan filtrlar */}
            <div
                id={`${id}-advanced`}
                hidden={!expanded}
                className={cn('grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-5')}
            >
                <Field htmlFor={`${id}-region`} label={t('common.region')}>
                    <SelectField
                        id={`${id}-region`}
                        value={draft.regionId}
                        disabled={loading}
                        emptyOption={t('filters.allRegions')}
                        options={scope.regions}
                        onValueChange={(value) =>
                            setDraft((previous) => ({ ...previous, regionId: value, districtId: '', schoolId: '', classId: '' }))
                        }
                    />
                </Field>
                <Field htmlFor={`${id}-district`} label={t('common.district')}>
                    <SelectField
                        id={`${id}-district`}
                        value={draft.districtId}
                        disabled={loading}
                        emptyOption={t('filters.allDistricts')}
                        options={scope.districts}
                        onValueChange={(value) =>
                            setDraft((previous) => ({ ...previous, districtId: value, schoolId: '', classId: '' }))
                        }
                    />
                </Field>
                <Field htmlFor={`${id}-school`} label={t('common.school')}>
                    <SelectField
                        id={`${id}-school`}
                        value={draft.schoolId}
                        disabled={loading}
                        emptyOption={t('filters.allSchools')}
                        options={scope.schools}
                        onValueChange={(value) => setDraft((previous) => ({ ...previous, schoolId: value, classId: '' }))}
                    />
                </Field>

                {mode !== 'teachers' &&
                    (draft.schoolId ? (
                        <ClassFilter
                            key={`${draft.schoolId}-${academicYearFor(draft.date)}`}
                            id={`${id}-class`}
                            schoolId={draft.schoolId}
                            date={draft.date}
                            value={draft.classId}
                            onChange={(value) => update('classId', value)}
                        />
                    ) : (
                        <Field htmlFor={`${id}-class`} label={t('common.class')}>
                            <SelectField
                                id={`${id}-class`}
                                value=""
                                onValueChange={() => undefined}
                                disabled
                                placeholder={t('filters.chooseSchoolFirst')}
                                options={[]}
                            />
                        </Field>
                    ))}

                <Field htmlFor={`${id}-pnfl`} label={t('common.pnfl')}>
                    <Input
                        id={`${id}-pnfl`}
                        value={draft.pnfl}
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        maxLength={14}
                        placeholder={t('common.pnflHint')}
                        title={t('common.pnflInvalid')}
                        onChange={(event) => update('pnfl', event.target.value.replace(/\D/g, ''))}
                        className="tabular-nums"
                    />
                </Field>

                <div className="flex items-end sm:col-span-2 xl:col-span-5 xl:justify-end">
                    <Button type="button" variant="ghost" onClick={clearFilters}>
                        <X aria-hidden="true" />
                        {t('common.clearFilters')}
                    </Button>
                </div>
            </div>

            {error && <ErrorState message={error} onRetry={retry} />}
        </form>
    );
}
