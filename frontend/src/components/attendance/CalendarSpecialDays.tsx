import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarOff, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPatch, authorizedPost } from '@/lib/auth-session';
import { formatDate } from '@/lib/date';
import type { School } from '@/types/school';

type DayType = 'DAY_OFF' | 'WORK_DAY';
type AppliesTo = 'STUDENT' | 'TEACHER' | 'BOTH';
type ScopeType = 'GLOBAL' | 'REGION' | 'DISTRICT' | 'SCHOOL';

interface CalendarRule {
    id: number;
    startDate: string;
    endDate: string;
    dayType: DayType;
    appliesTo: AppliesTo;
    scopeType: ScopeType;
    regionId: number | null;
    districtId: number | null;
    schoolId: number | null;
    classId: number | null;
    isMandatory: boolean;
    isActive: boolean;
    reason: string;
}

interface Props {
    school: School;
    academicYear: string;
}

export function CalendarSpecialDays({ school, academicYear }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const { confirm, dialog } = useConfirm();
    const profile = session?.profile;
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

    const yearStart = `${academicYear.slice(0, 4)}-09-01`;
    const yearEnd = `${academicYear.slice(5)}-08-31`;

    const [startDate, setStartDate] = useState(yearStart);
    const [endDate, setEndDate] = useState(yearStart);
    const [dayType, setDayType] = useState<DayType>('DAY_OFF');
    const [appliesTo, setAppliesTo] = useState<AppliesTo>('STUDENT');
    const [scopeType, setScopeType] = useState<'SCHOOL' | 'GLOBAL'>('SCHOOL');
    const [isMandatory, setIsMandatory] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const saving = useRef(false);

    const params = new URLSearchParams({ schoolId: String(school.id), startDate: yearStart, endDate: yearEnd });
    const query = useApiQuery<CalendarRule[]>(`/attendance-calendar/rules?${params.toString()}`);

    function canCancel(rule: CalendarRule): boolean {
        if (!profile) return false;
        if (profile.role === 'SUPER_ADMIN') return true;
        if (rule.scopeType === 'GLOBAL') return false;

        if (profile.role === 'REGION_ADMIN') {
            if (rule.scopeType === 'REGION') return rule.regionId === profile.regionId;
            if (rule.scopeType === 'DISTRICT') {
                return rule.districtId === school.districtId && school.district.regionId === profile.regionId;
            }
            return rule.schoolId === school.id && school.district.regionId === profile.regionId;
        }
        if (profile.role === 'DISTRICT_ADMIN') {
            if (rule.scopeType === 'REGION') return false;
            return (
                school.districtId === profile.districtId &&
                (rule.districtId === profile.districtId || rule.schoolId === school.id)
            );
        }
        return profile.role === 'SCHOOL_ADMIN' && rule.scopeType === 'SCHOOL' && rule.schoolId === profile.schoolId;
    }

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        setError('');
        setSuccess('');

        if (!startDate || !endDate || startDate < yearStart || endDate > yearEnd || endDate < startDate) {
            return setError(t('calendar.errors.range'));
        }
        if (reason.trim().length < 3) return setError(t('calendar.special.errors.reason'));

        saving.current = true;
        setBusy(true);
        try {
            await authorizedPost('/attendance-calendar/rules', {
                startDate,
                endDate,
                dayType,
                appliesTo,
                scopeType,
                ...(scopeType === 'SCHOOL' ? { schoolId: school.id } : { isMandatory }),
                reason: reason.trim(),
            });
            setSuccess(t('calendar.special.created'));
            setReason('');
            query.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('calendar.special.createFailed'));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    async function handleCancel(rule: CalendarRule) {
        if (cancellingId !== null || !canCancel(rule)) return;
        const confirmed = await confirm({
            title: t('calendar.special.cancelTitle'),
            description: t('calendar.special.cancelConfirm', { reason: rule.reason }),
            confirmLabel: t('calendar.special.cancel'),
            destructive: true,
        });
        if (!confirmed) return;

        setError('');
        setSuccess('');
        setCancellingId(rule.id);
        try {
            await authorizedPatch(`/attendance-calendar/rules/${rule.id}/cancel`, {});
            setSuccess(t('calendar.special.cancelled'));
            query.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('calendar.special.cancelFailed'));
        } finally {
            setCancellingId(null);
        }
    }

    function scopeText(rule: CalendarRule) {
        return (
            <>
                {t(`calendar.scopes.${rule.scopeType}`)}
                {rule.classId !== null && ` · ${t('calendar.classId', { id: rule.classId })}`}
                {rule.isMandatory && <span className="block text-xs text-muted-foreground">{t('calendar.special.mandatory')}</span>}
            </>
        );
    }

    function dayTypeBadge(rule: CalendarRule) {
        return (
            <StatusBadge tone={rule.dayType === 'DAY_OFF' ? 'warning' : 'success'}>
                {t(`calendar.dayTypes.${rule.dayType}`)}
            </StatusBadge>
        );
    }

    function cancelButton(rule: CalendarRule) {
        return canCancel(rule) ? (
            <Button type="button" variant="outline" size="sm" disabled={cancellingId !== null} onClick={() => void handleCancel(rule)}>
                {cancellingId === rule.id ? t('calendar.special.cancelling') : t('calendar.special.cancel')}
            </Button>
        ) : (
            <span className="text-xs text-muted-foreground">{t('calendar.special.viewOnly')}</span>
        );
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {dialog}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('calendar.special.createTitle')}</CardTitle>
                    <CardDescription>{t('calendar.special.createHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreate} className="space-y-5">
                        <fieldset disabled={busy} className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                                <Field htmlFor={`${id}-type`} label={t('calendar.special.dayType')}>
                                    <SelectField
                                        id={`${id}-type`}
                                        value={dayType}
                                        onValueChange={(value) => setDayType(value as DayType)}
                                        options={(['DAY_OFF', 'WORK_DAY'] as const).map((value) => ({ value, label: t(`calendar.dayTypes.${value}`) }))}
                                    />
                                </Field>
                                <Field htmlFor={`${id}-who`} label={t('calendar.audience')}>
                                    <SelectField
                                        id={`${id}-who`}
                                        value={appliesTo}
                                        onValueChange={(value) => setAppliesTo(value as AppliesTo)}
                                        options={(['STUDENT', 'TEACHER', 'BOTH'] as const).map((value) => ({ value, label: t(`calendar.audiences.${value}`) }))}
                                    />
                                </Field>
                                <Field htmlFor={`${id}-scope`} label={t('calendar.special.scope')}>
                                    <SelectField
                                        id={`${id}-scope`}
                                        value={scopeType}
                                        onValueChange={(value) => {
                                            setScopeType(value as 'SCHOOL' | 'GLOBAL');
                                            setIsMandatory(false);
                                        }}
                                        options={[
                                            { value: 'SCHOOL', label: t('calendar.special.thisSchool') },
                                            ...(isSuperAdmin ? [{ value: 'GLOBAL', label: t('calendar.special.national') }] : []),
                                        ]}
                                    />
                                </Field>
                            </div>

                            {scopeType === 'GLOBAL' && isSuperAdmin && (
                                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                                    <Label htmlFor={`${id}-mandatory`} className="leading-5">
                                        {t('calendar.special.mandatoryLabel')}
                                    </Label>
                                    <Switch id={`${id}-mandatory`} checked={isMandatory} onCheckedChange={setIsMandatory} />
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field htmlFor={`${id}-start`} label={t('membership.startDate')} required>
                                    <Input
                                        id={`${id}-start`}
                                        type="date"
                                        value={startDate}
                                        min={yearStart}
                                        max={yearEnd}
                                        required
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            setStartDate(next);
                                            if (endDate < next) setEndDate(next);
                                        }}
                                    />
                                </Field>
                                <Field htmlFor={`${id}-end`} label={t('membership.endDate')} required>
                                    <Input
                                        id={`${id}-end`}
                                        type="date"
                                        value={endDate}
                                        min={startDate}
                                        max={yearEnd}
                                        required
                                        onChange={(event) => setEndDate(event.target.value)}
                                    />
                                </Field>
                            </div>

                            <Field htmlFor={`${id}-reason`} label={t('calendar.special.reason')} required>
                                <Input
                                    id={`${id}-reason`}
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    maxLength={500}
                                    placeholder={t('calendar.special.reasonPlaceholder')}
                                    required
                                />
                            </Field>
                        </fieldset>

                        {error && <ErrorState message={error} />}
                        {success && <SuccessNotice>{success}</SuccessNotice>}

                        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                            {busy ? t('common.saving') : t('calendar.special.submit')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-semibold">{t('calendar.special.listTitle')}</h2>
                    <Button type="button" variant="outline" size="sm" onClick={query.retry}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {query.loading ? (
                    <LoadingState rows={3} />
                ) : query.error ? (
                    <ErrorState message={query.error} onRetry={query.retry} />
                ) : query.data?.length ? (
                    <>
                        <ul className="grid list-none gap-3 sm:grid-cols-2 2xl:hidden">
                            {query.data.map((rule) => (
                                <li key={rule.id}>
                                    <Card size="sm" className="gap-3 px-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{rule.reason}</p>
                                            {dayTypeBadge(rule)}
                                        </div>
                                        <DetailList>
                                            <DetailItem label={t('common.date')} wide>
                                                <span className="tabular-nums">
                                                    {formatDate(rule.startDate)} — {formatDate(rule.endDate)}
                                                </span>
                                            </DetailItem>
                                            <DetailItem label={t('calendar.audience')}>{t(`calendar.audiences.${rule.appliesTo}`)}</DetailItem>
                                            <DetailItem label={t('calendar.special.scope')}>{scopeText(rule)}</DetailItem>
                                        </DetailList>
                                        <div className="border-t pt-3">{cancelButton(rule)}</div>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                        <Card className="hidden py-0 2xl:flex">
                            <Table className="min-w-[720px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-5">{t('common.date')}</TableHead>
                                        <TableHead>{t('calendar.special.dayType')}</TableHead>
                                        <TableHead>{t('calendar.audience')}</TableHead>
                                        <TableHead>{t('calendar.special.scope')}</TableHead>
                                        <TableHead>{t('calendar.special.reason')}</TableHead>
                                        <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {query.data.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell className="pl-5 tabular-nums">
                                                {formatDate(rule.startDate)} — {formatDate(rule.endDate)}
                                            </TableCell>
                                            <TableCell>{dayTypeBadge(rule)}</TableCell>
                                            <TableCell>{t(`calendar.audiences.${rule.appliesTo}`)}</TableCell>
                                            <TableCell>{scopeText(rule)}</TableCell>
                                            <TableCell className="max-w-56 whitespace-normal">{rule.reason}</TableCell>
                                            <TableCell className="pr-5 text-right">{cancelButton(rule)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                ) : (
                    <EmptyState icon={CalendarOff} title={t('calendar.special.emptyTitle')} description={t('calendar.special.empty')} />
                )}
            </section>
        </div>
    );
}
