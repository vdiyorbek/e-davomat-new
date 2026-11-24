import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Settings } from 'lucide-react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { monthName, weekdayIndex, weekdayName, formatDate, formatTime } from '@/lib/date';
import { loadTelegram, parentRequest, ParentApiError, telegramApp } from '@/lib/parent-api';
import { cn } from '@/lib/utils';
import type { DayStatus, ParentChild, ParentExcuse, ParentMe, ParentMonth } from '@/types/parent';

const LANGUAGES: { value: string; label: string }[] = [
    { value: 'uz', label: 'O‘zbekcha' },
    { value: 'uz-Cyrl', label: 'Ўзбекча' },
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
    { value: 'kk', label: 'Қазақша' },
    { value: 'ky', label: 'Кыргызча' },
    { value: 'tg', label: 'Тоҷикӣ' },
];

const TONE: Record<string, StatusTone> = {
    left: 'success',
    inside: 'success',
    absent: 'danger',
    excused: 'info',
    day_off: 'neutral',
    anomaly: 'warning',
};

function statusKey(status: DayStatus): string {
    return ['left', 'inside', 'absent', 'excused', 'day_off', 'anomaly'].includes(status) ? status : 'unknown';
}

function shiftMonth(month: string, delta: number): string {
    const [year = 2026, mon = 1] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function DayRow({ day }: { day: ParentMonth['days'][number] }) {
    const { t } = useTranslation();
    const key = statusKey(day.status);
    const muted = key === 'day_off' || key === 'unknown';
    const [, , dd = ''] = day.date.split('-');
    return (
        <li className={cn('flex items-center gap-3 px-4 py-3', muted && 'opacity-60')}>
            <div className="w-11 shrink-0 text-center">
                <p className="text-lg leading-none font-bold tabular-nums">{Number(dd)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{weekdayName(weekdayIndex(day.date), 'short')}</p>
            </div>
            <div className="min-w-0 flex-1">
                <StatusBadge tone={TONE[key] ?? 'neutral'}>{t(`parent.status.${key}`)}</StatusBadge>
                {(day.firstInTime || day.lastOutTime) && (
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {day.firstInTime && <span>{t('parent.arrived', { time: formatTime(day.firstInTime) })}</span>}
                        {day.firstInTime && day.lastOutTime && ' · '}
                        {day.lastOutTime && <span>{t('parent.left', { time: formatTime(day.lastOutTime) })}</span>}
                    </p>
                )}
            </div>
        </li>
    );
}

function AttendanceTab({ child, today }: { child: ParentChild; today: string }) {
    const { t } = useTranslation();
    const currentMonth = today.slice(0, 7);
    const [month, setMonth] = useState(currentMonth);
    const requestKey = `${child.personId}:${month}`;
    const [loaded, setLoaded] = useState<{ key: string; data?: ParentMonth; error?: string } | null>(null);

    useEffect(() => {
        let active = true;
        parentRequest<ParentMonth>(`/children/${child.personId}/attendance?month=${month}`)
            .then((result) => active && setLoaded({ key: requestKey, data: result }))
            .catch((err: unknown) => active && setLoaded({ key: requestKey, error: err instanceof Error ? err.message : t('parent.failed') }));
        return () => {
            active = false;
        };
    }, [child.personId, month, requestKey, t]);

    const data = loaded?.key === requestKey ? (loaded.data ?? null) : null;
    const error = loaded?.key === requestKey ? (loaded.error ?? '') : '';

    const todayRow = data?.days.find((day) => day.date === today) ?? null;
    const [year = '', mon = '1'] = month.split('-');
    const present = data ? data.stats.left + data.stats.inside : 0;

    return (
        <div className="space-y-4">
            {month === currentMonth && (
                <Card className="gap-2 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('parent.today')}</p>
                    {todayRow ? (
                        <>
                            <StatusBadge tone={TONE[statusKey(todayRow.status)] ?? 'neutral'} className="w-fit">
                                {t(`parent.status.${statusKey(todayRow.status)}`)}
                            </StatusBadge>
                            {(todayRow.firstInTime || todayRow.lastOutTime) && (
                                <p className="text-sm tabular-nums">
                                    {todayRow.firstInTime && <span>{t('parent.arrived', { time: formatTime(todayRow.firstInTime) })}</span>}
                                    {todayRow.firstInTime && todayRow.lastOutTime && ' · '}
                                    {todayRow.lastOutTime && <span>{t('parent.left', { time: formatTime(todayRow.lastOutTime) })}</span>}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">{data ? t('parent.noDataToday') : '…'}</p>
                    )}
                </Card>
            )}

            <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="icon" aria-label={t('parent.prevMonth')} onClick={() => setMonth(shiftMonth(month, -1))}>
                    <ChevronLeft aria-hidden="true" />
                </Button>
                <p className="font-heading text-base font-bold">
                    {monthName(Number(mon))} {year}
                </p>
                <Button type="button" variant="outline" size="icon" aria-label={t('parent.nextMonth')} disabled={month >= currentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
                    <ChevronRight aria-hidden="true" />
                </Button>
            </div>

            {data && (
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { key: 'present', value: present, tone: 'text-success' },
                        { key: 'absent', value: data.stats.absent, tone: 'text-destructive' },
                        { key: 'excused', value: data.stats.excused, tone: 'text-info' },
                    ].map((item) => (
                        <div key={item.key} className="rounded-xl border bg-card px-2 py-2.5">
                            <p className={cn('text-2xl leading-none font-bold tabular-nums', item.tone)}>{item.value}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{t(`parent.stats.${item.key}`)}</p>
                        </div>
                    ))}
                </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {!data && !error && <div className="h-40 animate-pulse rounded-2xl bg-muted/50" aria-busy="true" />}
            {data && (
                <Card className="gap-0 overflow-hidden p-0">
                    <ul className="list-none divide-y">
                        {data.days.map((day) => (
                            <DayRow key={day.date} day={day} />
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

function ExcusesTab({ child }: { child: ParentChild }) {
    const { t } = useTranslation();
    const [loaded, setLoaded] = useState<{ id: number; items?: ParentExcuse[]; error?: string } | null>(null);

    useEffect(() => {
        let active = true;
        parentRequest<ParentExcuse[]>(`/children/${child.personId}/excuses`)
            .then((result) => active && setLoaded({ id: child.personId, items: result }))
            .catch((err: unknown) => active && setLoaded({ id: child.personId, error: err instanceof Error ? err.message : t('parent.failed') }));
        return () => {
            active = false;
        };
    }, [child.personId, t]);

    const items = loaded?.id === child.personId ? (loaded.items ?? null) : null;
    const error = loaded?.id === child.personId ? (loaded.error ?? '') : '';

    const tone: Record<ParentExcuse['status'], StatusTone> = { PENDING: 'warning', ACTIVE: 'success', REJECTED: 'danger', CANCELLED: 'neutral' };

    if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
    if (!items) return <div className="h-32 animate-pulse rounded-2xl bg-muted/50" aria-busy="true" />;
    if (items.length === 0) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t('parent.noExcuses')}</p>;

    return (
        <ul className="list-none space-y-3">
            {items.map((item) => (
                <li key={item.id}>
                    <Card className="gap-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold tabular-nums">
                                {formatDate(item.from)} — {formatDate(item.to)}
                            </p>
                            <StatusBadge tone={tone[item.status]} className="shrink-0">
                                {t(`parent.excuseStatus.${item.status}`)}
                            </StatusBadge>
                        </div>
                        <p className="text-sm text-muted-foreground">{t(`parent.reasons.${item.reason}`, { defaultValue: item.reason })}</p>
                        {item.status === 'REJECTED' && item.rejectionReason && (
                            <p className="text-sm text-destructive [overflow-wrap:anywhere]">{t('parent.rejectedReason', { text: item.rejectionReason })}</p>
                        )}
                    </Card>
                </li>
            ))}
        </ul>
    );
}

function SettingsTab({ me, onChange }: { me: ParentMe; onChange: (next: ParentMe) => void }) {
    const { t } = useTranslation();
    const [error, setError] = useState('');

    async function save(body: Record<string, unknown>) {
        setError('');
        try {
            const next = await parentRequest<ParentMe>('/me', { method: 'PATCH', body });
            onChange(next);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parent.failed'));
        }
    }

    const prefs = ['arrival', 'leave', 'absent', 'excuse'] as const;
    return (
        <div className="space-y-4">
            <Card className="gap-3 p-4">
                <p className="text-sm font-semibold">{t('parent.language')}</p>
                <SelectField
                    value={me.language}
                    onValueChange={(value) => void save({ language: value })}
                    options={LANGUAGES}
                    aria-label={t('parent.language')}
                />
            </Card>
            <Card className="gap-1 p-4">
                <p className="mb-1 text-sm font-semibold">{t('parent.notifications')}</p>
                {prefs.map((pref) => (
                    <label key={pref} className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-sm">
                        <span>{t(`parent.prefs.${pref}`)}</span>
                        <Switch checked={me.preferences[pref]} onCheckedChange={(checked) => void save({ [pref]: checked })} />
                    </label>
                ))}
            </Card>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

/** Telegram Mini App: ota-ona uchun farzandining davomati va tarixi. */
export function ParentApp() {
    const { t } = useTranslation();
    const [me, setMe] = useState<ParentMe | null>(null);
    const [error, setError] = useState<{ status: number; message: string } | null>(null);
    const [childId, setChildId] = useState<number | null>(null);

    const apply = useCallback((next: ParentMe) => {
        setMe(next);
        setChildId((current) => current ?? next.children[0]?.personId ?? null);
        if (next.language && i18n.resolvedLanguage !== next.language) void i18n.changeLanguage(next.language);
    }, []);

    useEffect(() => {
        let active = true;
        void (async () => {
            const app = await loadTelegram();
            if (!active) return;
            if (!app || !app.initData) {
                setError({ status: 0, message: '' });
                return;
            }
            app.ready();
            app.expand?.();
            document.documentElement.classList.toggle('dark', app.colorScheme === 'dark');
            try {
                const result = await parentRequest<ParentMe>('/me');
                if (active) apply(result);
            } catch (err: unknown) {
                if (active) setError({ status: err instanceof ParentApiError ? err.status : 0, message: err instanceof Error ? err.message : '' });
            }
        })();
        return () => {
            active = false;
        };
    }, [apply]);

    const child = me?.children.find((item) => item.personId === childId) ?? null;

    if (error) {
        const key = error.status === 403 ? 'notLinked' : error.status === 0 && !telegramApp()?.initData ? 'openInTelegram' : 'failed';
        return (
            <main className="mx-auto grid min-h-svh max-w-md place-items-center bg-background p-6 text-center text-foreground">
                <p className="text-sm leading-6 text-muted-foreground">{t(`parent.${key}`)}</p>
            </main>
        );
    }

    if (!me) {
        return (
            <main className="mx-auto min-h-svh max-w-md bg-background p-4" aria-busy="true">
                <div className="h-40 animate-pulse rounded-2xl bg-muted/50" />
            </main>
        );
    }

    return (
        <main className="mx-auto min-h-svh max-w-md bg-background px-4 pt-4 pb-10 text-foreground">
            <header className="mb-4 space-y-3">
                <h1 className="font-heading text-xl font-bold">{t('parent.title')}</h1>
                {me.children.length > 1 ? (
                    <SelectField
                        value={String(childId ?? '')}
                        onValueChange={(value) => setChildId(Number(value))}
                        options={me.children.map((item) => ({ value: String(item.personId), label: `${item.lastName} ${item.firstName}` }))}
                        aria-label={t('parent.child')}
                    />
                ) : null}
                {child && (
                    <div>
                        <p className="font-heading text-lg leading-tight font-bold [overflow-wrap:anywhere]">
                            {child.lastName} {child.firstName}
                        </p>
                        <p className="text-sm text-muted-foreground">{[child.schoolName, child.className].filter(Boolean).join(' · ')}</p>
                    </div>
                )}
            </header>

            <Tabs defaultValue="attendance" className="gap-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="attendance">
                        <CalendarDays aria-hidden="true" />
                        {t('parent.tabs.attendance')}
                    </TabsTrigger>
                    <TabsTrigger value="excuses">
                        <FileText aria-hidden="true" />
                        {t('parent.tabs.excuses')}
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                        <Settings aria-hidden="true" />
                        {t('parent.tabs.settings')}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="attendance">{child && <AttendanceTab key={child.personId} child={child} today={me.today} />}</TabsContent>
                <TabsContent value="excuses">{child && <ExcusesTab key={child.personId} child={child} />}</TabsContent>
                <TabsContent value="settings">
                    <SettingsTab me={me} onChange={apply} />
                </TabsContent>
            </Tabs>
        </main>
    );
}
