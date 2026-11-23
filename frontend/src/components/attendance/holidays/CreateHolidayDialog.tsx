import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarPlus, GraduationCap, Presentation, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { daysInRange, isIsoDate } from '@/lib/attendance-summary';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearFor, todayInTashkent } from '@/lib/date';
import { allowedScopes } from '@/lib/holidays';
import { schoolScopeOptions } from '@/lib/school-scope';
import { cn } from '@/lib/utils';
import type { HolidayAppliesTo, HolidayDayType, HolidayScope } from '@/types/holiday';
import type { School } from '@/types/school';
import { DatePicker } from '@/components/common/DatePicker';

const MAX_DAYS = 366;

const AUDIENCES: { value: HolidayAppliesTo; icon: typeof Users }[] = [
    { value: 'STUDENT', icon: GraduationCap },
    { value: 'TEACHER', icon: Presentation },
    { value: 'BOTH', icon: Users },
];

interface ClassOption {
    id: number;
    name: string;
}

/** Ixtiyoriy sinf tanlovi (faqat maktab + o‘quvchilar uchun). */
function OptionalClassSelect({
    schoolId,
    academicYear,
    value,
    onChange,
}: {
    schoolId: string;
    academicYear: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const params = new URLSearchParams({ schoolId, academicYear });
    const { data, loading, error } = useApiQuery<ClassOption[]>(`/classes?${params.toString()}`);

    return (
        <Field htmlFor={id} label={`${t('common.class')} (${t('common.optional')})`} hint={t('holidays.form.classHint')} error={error || undefined}>
            <SelectField
                id={id}
                value={value}
                onValueChange={onChange}
                searchable
                disabled={loading || Boolean(error)}
                emptyOption={t('holidays.form.allClasses')}
                options={(data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
            />
        </Field>
    );
}

interface Props {
    onCreated: () => void;
}

export function CreateHolidayDialog({ onCreated }: Props) {
    const { t } = useTranslation();
    const ids = useId();
    const { session } = useAuth();
    const profile = session?.profile;
    const role = profile?.role;
    const scopes = allowedScopes(role);

    const [open, setOpen] = useState(false);
    const [startDate, setStartDate] = useState(todayInTashkent);
    const [endDate, setEndDate] = useState(todayInTashkent);
    const [dayType, setDayType] = useState<HolidayDayType>('DAY_OFF');
    const [appliesTo, setAppliesTo] = useState<HolidayAppliesTo>('STUDENT');
    const [scopeType, setScopeType] = useState<HolidayScope>(scopes[0] ?? 'SCHOOL');
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [classId, setClassId] = useState('');
    const [isMandatory, setIsMandatory] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);

    const { data: schools, loading: schoolsLoading, error: schoolsError } = useApiQuery<School[]>('/schools');

    // Admin o‘z hududiga bog‘langan: viloyat/tuman/maktab avtomatik tanlanadi.
    const fixedRegion = role === 'REGION_ADMIN' ? String(profile?.regionId ?? '') : '';
    const fixedDistrict = role === 'DISTRICT_ADMIN' ? String(profile?.districtId ?? '') : '';
    const fixedSchool = role === 'SCHOOL_ADMIN' ? String(profile?.schoolId ?? '') : '';

    const effectiveRegion = fixedRegion || regionId;
    const effectiveDistrict = fixedDistrict || districtId;
    const effectiveSchool = fixedSchool || schoolId;

    const scope = schoolScopeOptions(schools, effectiveRegion, effectiveDistrict);
    const days = isIsoDate(startDate) && isIsoDate(endDate) && startDate <= endDate ? daysInRange(startDate, endDate) : 0;
    const canPickClass = scopeType === 'SCHOOL' && appliesTo === 'STUDENT' && Boolean(effectiveSchool) && isIsoDate(startDate);

    function reset() {
        const today = todayInTashkent();
        setStartDate(today);
        setEndDate(today);
        setDayType('DAY_OFF');
        setAppliesTo('STUDENT');
        setScopeType(scopes[0] ?? 'SCHOOL');
        setRegionId('');
        setDistrictId('');
        setSchoolId('');
        setClassId('');
        setIsMandatory(false);
        setReason('');
        setError('');
    }

    function validate(): string | null {
        if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) return t('holidays.errors.range');
        if (days > MAX_DAYS) return t('holidays.errors.tooLong', { max: MAX_DAYS });
        if (scopeType === 'REGION' && !effectiveRegion) return t('holidays.errors.region');
        if (scopeType === 'DISTRICT' && !effectiveDistrict) return t('holidays.errors.district');
        if (scopeType === 'SCHOOL' && !effectiveSchool) return t('holidays.errors.school');
        const trimmed = reason.trim();
        if (trimmed.length < 3 || trimmed.length > 500) return t('holidays.errors.reason');
        return null;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }

        const target: Record<string, number | boolean> = {};
        if (scopeType === 'GLOBAL') target.isMandatory = isMandatory;
        if (scopeType === 'REGION') target.regionId = Number(effectiveRegion);
        if (scopeType === 'DISTRICT') target.districtId = Number(effectiveDistrict);
        if (scopeType === 'SCHOOL') {
            target.schoolId = Number(effectiveSchool);
            if (canPickClass && classId) target.classId = Number(classId);
        }

        saving.current = true;
        setBusy(true);
        setError('');
        try {
            await authorizedPost('/attendance-calendar/rules', {
                startDate,
                endDate,
                dayType,
                appliesTo,
                scopeType,
                ...target,
                reason: reason.trim(),
            });
            setOpen(false);
            reset();
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('holidays.errors.saveFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    if (scopes.length === 0) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button type="button">
                    <CalendarPlus aria-hidden="true" />
                    {t('holidays.create')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('holidays.form.title')}</DialogTitle>
                    <DialogDescription>{t('holidays.form.description')}</DialogDescription>
                </DialogHeader>

                <form id={`${ids}-form`} className="space-y-5" onSubmit={handleSubmit} noValidate>
                    {/* Kimlar uchun */}
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">{t('holidays.form.audience')}</legend>
                        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                            {AUDIENCES.map(({ value, icon: Icon }) => {
                                const active = appliesTo === value;
                                return (
                                    <Button variant="ghost" size="auto"
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setAppliesTo(value)}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                                            active ? 'border-primary bg-primary/8 ring-1 ring-primary' : 'bg-card hover:bg-muted/60',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'grid size-9 shrink-0 place-items-center rounded-lg',
                                                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            <Icon aria-hidden="true" className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{t(`holidays.audiences.${value}`)}</span>
                                            <span className="block text-xs text-muted-foreground">{t(`holidays.audienceHints.${value}`)}</span>
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field htmlFor={`${ids}-start`} label={t('holidays.form.startDate')} required>
                            <DatePicker
                                id={`${ids}-start`}
                                value={startDate}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setStartDate(value);
                                    if (value && endDate < value) setEndDate(value);
                                }}
                            />
                        </Field>
                        <Field
                            htmlFor={`${ids}-end`}
                            label={t('holidays.form.endDate')}
                            required
                            hint={days > 0 ? t('holidays.daysCount', { count: days }) : undefined}
                        >
                            <DatePicker id={`${ids}-end`} value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
                        </Field>

                        <Field htmlFor={`${ids}-type`} label={t('holidays.form.dayType')} hint={t(`holidays.dayTypeHints.${dayType}`)}>
                            <SelectField
                                id={`${ids}-type`}
                                value={dayType}
                                onValueChange={(value) => setDayType(value as HolidayDayType)}
                                options={(['DAY_OFF', 'WORK_DAY'] as const).map((value) => ({ value, label: t(`holidays.dayTypes.${value}`) }))}
                            />
                        </Field>

                        <Field htmlFor={`${ids}-scope`} label={t('holidays.form.scope')}>
                            <SelectField
                                id={`${ids}-scope`}
                                value={scopeType}
                                disabled={scopes.length === 1}
                                onValueChange={(value) => {
                                    setScopeType(value as HolidayScope);
                                    setClassId('');
                                    if (value !== 'GLOBAL') setIsMandatory(false);
                                }}
                                options={scopes.map((value) => ({ value, label: t(`holidays.scopes.${value}`) }))}
                            />
                        </Field>

                        {/* Hudud tanlovi — faqat tanlash mumkin bo‘lgan darajalar */}
                        {scopeType !== 'GLOBAL' && role === 'SUPER_ADMIN' && (
                            <Field htmlFor={`${ids}-region`} label={t('common.region')} required={scopeType === 'REGION'}>
                                <SelectField
                                    id={`${ids}-region`}
                                    value={regionId}
                                    searchable
                                    disabled={schoolsLoading}
                                    placeholder={t('holidays.form.chooseRegion')}
                                    emptyOption={scopeType === 'REGION' ? undefined : t('filters.allRegions')}
                                    onValueChange={(value) => {
                                        setRegionId(value);
                                        setDistrictId('');
                                        setSchoolId('');
                                        setClassId('');
                                    }}
                                    options={scope.regions}
                                />
                            </Field>
                        )}

                        {(scopeType === 'DISTRICT' || scopeType === 'SCHOOL') && !fixedDistrict && role !== 'SCHOOL_ADMIN' && (
                            <Field htmlFor={`${ids}-district`} label={t('common.district')} required={scopeType === 'DISTRICT'}>
                                <SelectField
                                    id={`${ids}-district`}
                                    value={districtId}
                                    searchable
                                    disabled={schoolsLoading}
                                    placeholder={t('holidays.form.chooseDistrict')}
                                    emptyOption={scopeType === 'DISTRICT' ? undefined : t('filters.allDistricts')}
                                    onValueChange={(value) => {
                                        setDistrictId(value);
                                        setSchoolId('');
                                        setClassId('');
                                    }}
                                    options={scope.districts}
                                />
                            </Field>
                        )}

                        {scopeType === 'SCHOOL' && !fixedSchool && (
                            <Field htmlFor={`${ids}-school`} label={t('common.school')} required className="sm:col-span-2">
                                <SelectField
                                    id={`${ids}-school`}
                                    value={schoolId}
                                    searchable
                                    disabled={schoolsLoading}
                                    placeholder={t('holidays.form.chooseSchool')}
                                    onValueChange={(value) => {
                                        setSchoolId(value);
                                        setClassId('');
                                    }}
                                    options={scope.schools}
                                />
                            </Field>
                        )}

                        {canPickClass && (
                            <div className="sm:col-span-2">
                                <OptionalClassSelect
                                    key={`${effectiveSchool}|${academicYearFor(startDate)}`}
                                    schoolId={effectiveSchool}
                                    academicYear={academicYearFor(startDate)}
                                    value={classId}
                                    onChange={setClassId}
                                />
                            </div>
                        )}
                    </div>

                    {schoolsError && scopeType !== 'GLOBAL' && <ErrorState message={schoolsError} />}

                    {scopeType === 'GLOBAL' && (
                        <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-3">
                            <div className="min-w-0">
                                <Label htmlFor={`${ids}-mandatory`}>{t('holidays.form.mandatory')}</Label>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('holidays.form.mandatoryHint')}</p>
                            </div>
                            <Switch id={`${ids}-mandatory`} checked={isMandatory} onCheckedChange={setIsMandatory} />
                        </div>
                    )}

                    <Field htmlFor={`${ids}-reason`} label={t('holidays.form.reason')} required hint={`${reason.trim().length}/500`}>
                        <Textarea
                            id={`${ids}-reason`}
                            value={reason}
                            maxLength={500}
                            rows={3}
                            placeholder={t('holidays.form.reasonPlaceholder')}
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </Field>

                    {error && <ErrorState message={error} />}
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" form={`${ids}-form`} disabled={busy}>
                        {busy ? t('common.saving') : t('holidays.form.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
