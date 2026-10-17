
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';

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

function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const part = (type: string) =>
        parts.find((item) => item.type === type)?.value ?? '';

    return `${part('year')}-${part('month')}-${part('day')}`;
}

function academicYearFor(date: string): string {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));

    const startYear = month >= 9 ? year : year - 1;

    return `${startYear}-${startYear + 1}`;
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

    const academicYear = academicYearFor(date);

    const path =
        `/classes?schoolId=${encodeURIComponent(schoolId)}` +
        `&academicYear=${encodeURIComponent(academicYear)}`;

    const {
        data: classes,
        loading,
        error,
        retry,
    } = useApiQuery<SchoolClassOption[]>(path);

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-sm font-semibold">
                {t('attendance.filterClass', {
                    defaultValue: 'Sinf',
                })}
            </label>

            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={loading || Boolean(error)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
            >
                <option value="">
                    {t('attendance.allClasses', {
                        defaultValue: 'Barcha sinflar',
                    })}
                </option>

                {(classes ?? []).map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                    </option>
                ))}
            </select>

            {loading && (
                <p className="text-xs text-muted-foreground">
                    Sinflar yuklanmoqda…
                </p>
            )}

            {error && (
                <div className="flex items-center gap-2">
                    <p role="alert" className="text-xs text-destructive">
                        {error}
                    </p>

                    <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={retry}
                    >
                        Qayta urinish
                    </Button>
                </div>
            )}
        </div>
    );
}

export function AttendanceFilters({
    values,
    onApply,
    mode = 'students',
}: Props) {
    const { t } = useTranslation();
    const id = useId();

    const [draft, setDraft] =
        useState<AttendanceFilterValues>(values);

    const {
        data: schools,
        loading,
        error,
        retry,
    } = useApiQuery<School[]>('/schools');

    // /schools API faqat foydalanuvchi ko‘rishi
    // mumkin bo‘lgan maktablarni qaytaradi.
    const permittedSchools = schools ?? [];

    const regionMap = new Map<number, string>();

    for (const school of permittedSchools) {
        regionMap.set(
            school.district.region.id,
            school.district.region.name,
        );
    }

    const regions = [...regionMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const districtMap = new Map<number, string>();

    for (const school of permittedSchools) {
        if (
            draft.regionId &&
            String(school.district.region.id) !== draft.regionId
        ) {
            continue;
        }

        districtMap.set(
            school.district.id,
            school.district.name,
        );
    }

    const districts = [...districtMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const filteredSchools = permittedSchools
        .filter((school) => {
            if (
                draft.regionId &&
                String(school.district.region.id) !== draft.regionId
            ) {
                return false;
            }

            if (
                draft.districtId &&
                String(school.districtId) !== draft.districtId
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    function update<K extends keyof AttendanceFilterValues>(
        key: K,
        value: AttendanceFilterValues[K],
    ) {
        setDraft((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        onApply({
            ...draft,
            classId: mode === 'teachers' ? '' : draft.classId,
            search: draft.search.trim(),
            pnfl: draft.pnfl.trim(),
        });
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

    const selectClassName =
        'h-11 w-full rounded-xl border border-input bg-card ' +
        'px-3 text-sm outline-none focus-visible:ring-2 ' +
        'focus-visible:ring-ring';

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                    {t('attendance.advancedFilters', {
                        defaultValue: 'Kengaytirilgan filtrlar',
                    })}
                </h2>

                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearFilters}
                >
                    {t('attendance.clearFilters')}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                    <label htmlFor={`${id}-date`} className="text-sm font-semibold">
                        {t('attendance.date')}
                    </label>

                    <Input
                        id={`${id}-date`}
                        type="date"
                        required
                        min="2000-01-01"
                        max={todayInTashkent()}
                        value={draft.date}
                        onChange={(event) =>
                            setDraft((previous) => ({
                                ...previous,
                                date: event.target.value,
                                classId: '',
                            }))
                        }
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${id}-region`} className="text-sm font-semibold">
                        {t('attendance.filterRegion', {
                            defaultValue: 'Viloyat',
                        })}
                    </label>

                    <select
                        id={`${id}-region`}
                        className={selectClassName}
                        value={draft.regionId}
                        disabled={loading}
                        onChange={(event) =>
                            setDraft((previous) => ({
                                ...previous,
                                regionId: event.target.value,
                                districtId: '',
                                schoolId: '',
                                classId: '',
                            }))
                        }
                    >
                        <option value="">Barcha viloyatlar</option>
                        {regions.map((region) => (
                            <option key={region.id} value={region.id}>
                                {region.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${id}-district`} className="text-sm font-semibold">
                        {t('attendance.filterDistrict', {
                            defaultValue: 'Tuman / shahar',
                        })}
                    </label>

                    <select
                        id={`${id}-district`}
                        className={selectClassName}
                        value={draft.districtId}
                        disabled={loading}
                        onChange={(event) =>
                            setDraft((previous) => ({
                                ...previous,
                                districtId: event.target.value,
                                schoolId: '',
                                classId: '',
                            }))
                        }
                    >
                        <option value="">Barcha tumanlar</option>
                        {districts.map((district) => (
                            <option key={district.id} value={district.id}>
                                {district.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${id}-school`} className="text-sm font-semibold">
                        {t('attendance.school')}
                    </label>

                    <select
                        id={`${id}-school`}
                        className={selectClassName}
                        value={draft.schoolId}
                        disabled={loading}
                        onChange={(event) =>
                            setDraft((previous) => ({
                                ...previous,
                                schoolId: event.target.value,
                                classId: '',
                            }))
                        }
                    >
                        <option value="">
                            {t('attendance.allSchools')}
                        </option>

                        {filteredSchools.map((school) => (
                            <option key={school.id} value={school.id}>
                                {school.name}
                            </option>
                        ))}
                    </select>
                </div>

                {mode !== 'teachers' && (
                    draft.schoolId ? (
                        <ClassFilter
                            key={`${draft.schoolId}-${academicYearFor(draft.date)}`}
                            id={`${id}-class`}
                            schoolId={draft.schoolId}
                            date={draft.date}
                            value={draft.classId}
                            onChange={(value) => update('classId', value)}
                        />
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">
                                Sinf
                            </label>
                            <select
                                disabled
                                className={selectClassName}
                                value=""
                            >
                                <option value="">
                                    Avval maktabni tanlang
                                </option>
                            </select>
                        </div>
                    )
                )}

                <div className="space-y-2">
                    <label htmlFor={`${id}-status`} className="text-sm font-semibold">
                        Davomat holati
                    </label>

                    <select
                        id={`${id}-status`}
                        className={selectClassName}
                        value={draft.attendanceStatus}
                        onChange={(event) =>
                            update('attendanceStatus', event.target.value)
                        }
                    >
                        <option value="">Barcha holatlar</option>
                        {(
                            mode === 'teachers'
                                ? (['inside', 'left', 'absent'] as const)
                                : (['inside', 'left', 'excused', 'absent'] as const)
                        ).map((status) => (
                            <option key={status} value={status}>
                                {t(`attendance.status.${status}`)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${id}-search`} className="text-sm font-semibold">
                        F.I.Sh. bo‘yicha qidirish
                    </label>

                    <Input
                        id={`${id}-search`}
                        value={draft.search}
                        minLength={2}
                        maxLength={100}
                        placeholder="Familiya yoki ism"
                        onChange={(event) =>
                            update('search', event.target.value)
                        }
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${id}-pnfl`} className="text-sm font-semibold">
                        {t('attendance.pnfl')}
                    </label>

                    <Input
                        id={`${id}-pnfl`}
                        value={draft.pnfl}
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        maxLength={14}
                        placeholder="14 ta raqam"
                        onChange={(event) =>
                            update('pnfl', event.target.value)
                        }
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3">
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                    <Button type="button" variant="outline" onClick={retry}>
                        Qayta urinish
                    </Button>
                </div>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={loading || Boolean(error)}>
                    {t('attendance.show')}
                </Button>
            </div>
        </form>
    );
}
