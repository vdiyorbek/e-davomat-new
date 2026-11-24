import { useCallback, useEffect, useId, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, FileText, Languages, Settings, UserRound } from 'lucide-react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { monthName, weekdayIndex, weekdayName, formatDate, formatDateLong, formatTime } from '@/lib/date';
import { loadTelegram, parentBlob, parentRequest, ParentApiError, telegramApp } from '@/lib/parent-api';
import { cn } from '@/lib/utils';
import type { DayStatus, ParentChild, ParentDay, ParentExcuse, ParentMe, ParentMonth } from '@/types/parent';

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

/** Kalendar katagi: holatga qarab fon va raqam rangi. */
const CELL: Record<string, string> = {
    left: 'bg-success/15 text-[color-mix(in_oklch,var(--success),var(--foreground)_30%)]',
    inside: 'bg-success/15 text-[color-mix(in_oklch,var(--success),var(--foreground)_30%)]',
    absent: 'bg-destructive/12 text-destructive',
    excused: 'bg-info/15 text-[color-mix(in_oklch,var(--info),var(--foreground)_25%)]',
    anomaly: 'bg-warning/20 text-[color-mix(in_oklch,var(--warning),var(--foreground)_62%)]',
    day_off: 'text-muted-foreground/50',
    unknown: 'text-muted-foreground/40',
};

const DOT: Record<string, string> = {
    left: 'bg-success',
    inside: 'bg-success',
    absent: 'bg-destructive',
    excused: 'bg-info',
    anomaly: 'bg-warning',
    day_off: 'bg-muted-foreground/40',
    unknown: 'bg-transparent',
};

type TabKey = 'attendance' | 'excuses' | 'settings';

/** Hammasi bosh harfda yozilgan ismni «Familiya Ism» ko‘rinishiga keltiradi. */
function niceName(value: string): string {
    const text = value.trim();
    if (text === '' || text !== text.toUpperCase() || text === text.toLowerCase()) return text;
    return text.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Farzand rasmi; rasm yo‘q yoki yuklanmasa — oddiy belgi. */
function ChildAvatar({ personId, hasPhoto, className }: { personId: number; hasPhoto: boolean; className?: string }) {
    // Holat shu farzandga bog‘langan: boshqa farzandga o‘tganda eski rasm ko‘rinmaydi.
    const [loaded, setLoaded] = useState<{ personId: number; url: string } | null>(null);

    useEffect(() => {
        if (!hasPhoto) return;
        const controller = new AbortController();
        let objectUrl = '';
        parentBlob(`/children/${personId}/photo`, controller.signal)
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setLoaded({ personId, url: objectUrl });
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [personId, hasPhoto]);

    const url = hasPhoto && loaded?.personId === personId ? loaded.url : '';

    return (
        <div className={cn('grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted text-muted-foreground', className)}>
            {url ? <img src={url} alt="" className="size-full object-cover" /> : <UserRound aria-hidden="true" className="size-[45%]" />}
        </div>
    );
}

function statusKey(status: DayStatus): string {
    return ['left', 'inside', 'absent', 'excused', 'day_off', 'anomaly'].includes(status) ? status : 'unknown';
}

function shiftMonth(month: string, delta: number): string {
    const [year = 2026, mon = 1] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Oylik ma’lumot: farzand yoki oy o‘zgarganda eski natija ko‘rsatilmaydi. */
function useMonth(personId: number, month: string) {
    const { t } = useTranslation();
    const key = `${personId}:${month}`;
    const [loaded, setLoaded] = useState<{ key: string; data?: ParentMonth; error?: string } | null>(null);

    useEffect(() => {
        let active = true;
        parentRequest<ParentMonth>(`/children/${personId}/attendance?month=${month}`)
            .then((result) => active && setLoaded({ key, data: result }))
            .catch((err: unknown) => active && setLoaded({ key, error: err instanceof Error ? err.message : t('parent.failed') }));
        return () => {
            active = false;
        };
    }, [personId, month, key, t]);

    return {
        data: loaded?.key === key ? (loaded.data ?? null) : null,
        error: loaded?.key === key ? (loaded.error ?? '') : '',
    };
}

function TimesLine({ day, className }: { day: ParentDay; className?: string }) {
    const { t } = useTranslation();
    if (!day.firstInTime && !day.lastOutTime) return null;
    return (
        <p className={cn('text-sm tabular-nums', className)}>
            {day.firstInTime && <span>{t('parent.arrived', { time: formatTime(day.firstInTime) })}</span>}
            {day.firstInTime && day.lastOutTime && ' · '}
            {day.lastOutTime && <span>{t('parent.left', { time: formatTime(day.lastOutTime) })}</span>}
        </p>
    );
}

/** Yuqoridagi gradient karta: farzand va bugungi holat. */
function Hero({ child, today }: { child: ParentChild; today: string }) {
    const { t } = useTranslation();
    const { data } = useMonth(child.personId, today.slice(0, 7));
    const todayRow = data?.days.find((day) => day.date === today) ?? null;
    const key = todayRow ? statusKey(todayRow.status) : 'unknown';
    const dot = key === 'absent' ? 'bg-destructive' : key === 'left' || key === 'inside' ? 'bg-success' : 'bg-white/70';

    return (
        <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white shadow-lg">
            <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
                <ChildAvatar personId={child.personId} hasPhoto={child.hasPhoto} className="size-[72px] border-white/40 ring-2 ring-white/50" />
                <div className="min-w-0">
                    <h1 className="font-heading text-xl leading-tight font-bold [overflow-wrap:anywhere]">
                        {niceName(`${child.lastName} ${child.firstName}`)}
                    </h1>
                    <p className="mt-0.5 text-sm text-white/80">{[child.schoolName, child.className].filter(Boolean).join(' · ')}</p>
                </div>
            </div>
            <div className="relative mt-5 rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">
                    {t('parent.today')} · {formatDate(today)}
                </p>
                {data ? (
                    <>
                        <div className="mt-1.5 flex items-center gap-2.5">
                            <span aria-hidden="true" className={cn('size-3 rounded-full ring-2 ring-white/60', dot)} />
                            <p className="font-heading text-2xl leading-none font-bold">
                                {todayRow ? t(`parent.status.${key}`) : t('parent.noDataToday')}
                            </p>
                        </div>
                        {todayRow && <TimesLine day={todayRow} className="mt-2 text-white/85" />}
                    </>
                ) : (
                    <div className="mt-2 h-8 w-40 animate-pulse rounded-lg bg-white/20" aria-busy="true" />
                )}
            </div>
        </section>
    );
}

/** Farzand tanlash: bir nechta bo‘lsa, rasmli tugmalar. */
function ChildPicker({ children, value, onChange }: { children: ParentChild[]; value: number | null; onChange: (id: number) => void }) {
    const { t } = useTranslation();
    return (
        <div role="group" aria-label={t('parent.child')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {children.map((item) => {
                const active = item.personId === value;
                return (
                    <button
                        key={item.personId}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(item.personId)}
                        className={cn(
                            'flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-semibold transition-colors',
                            active ? 'border-transparent bg-brand-gradient text-white shadow-md' : 'bg-card text-foreground',
                        )}
                    >
                        <ChildAvatar personId={item.personId} hasPhoto={item.hasPhoto} className="size-8" />
                        {niceName(item.firstName)}
                    </button>
                );
            })}
        </div>
    );
}

/** Boshqa tablarda: ixcham farzand sarlavhasi. */
function ChildStrip({ child }: { child: ParentChild }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
            <ChildAvatar personId={child.personId} hasPhoto={child.hasPhoto} className="size-11" />
            <div className="min-w-0">
                <p className="font-heading text-base leading-tight font-bold [overflow-wrap:anywhere]">
                    {niceName(`${child.lastName} ${child.firstName}`)}
                </p>
                <p className="text-xs text-muted-foreground">{[child.schoolName, child.className].filter(Boolean).join(' · ')}</p>
            </div>
        </div>
    );
}

/** Oylik davomat foizi: kelgan / (kelgan + kelmagan). */
function Ring({ percent }: { percent: number | null }) {
    const id = useId().replace(/:/g, '');
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden="true">
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--gradient-from)" />
                        <stop offset="100%" stopColor="var(--gradient-to)" />
                    </linearGradient>
                </defs>
                <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="9" className="stroke-muted" />
                {percent !== null && (
                    <circle
                        cx="44"
                        cy="44"
                        r={radius}
                        fill="none"
                        strokeWidth="9"
                        strokeLinecap="round"
                        stroke={`url(#${id})`}
                        strokeDasharray={`${(circumference * percent) / 100} ${circumference}`}
                    />
                )}
            </svg>
            <p className="absolute inset-0 grid place-items-center font-heading text-xl font-bold tabular-nums">{percent === null ? '—' : `${percent}%`}</p>
        </div>
    );
}

function MonthCalendar({
    month,
    days,
    today,
    selected,
    onSelect,
}: {
    month: string;
    days: ParentMonth['days'];
    today: string;
    selected: string | null;
    onSelect: (date: string) => void;
}) {
    const offset = weekdayIndex(`${month}-01`);
    return (
        <div>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                {Array.from({ length: 7 }, (_, index) => (
                    <span key={index}>{weekdayName(index, 'short')}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: offset }, (_, index) => (
                    <div key={`blank-${index}`} aria-hidden="true" />
                ))}
                {[...days].sort((left, right) => left.date.localeCompare(right.date)).map((day) => {
                    const key = statusKey(day.status);
                    const future = day.date > today;
                    const isSelected = day.date === selected;
                    return (
                        <button
                            key={day.date}
                            type="button"
                            disabled={future}
                            aria-pressed={isSelected}
                            onClick={() => onSelect(day.date)}
                            className={cn(
                                'relative grid aspect-square place-items-center rounded-xl text-sm font-semibold tabular-nums transition-shadow',
                                future ? 'text-muted-foreground/30' : (CELL[key] ?? CELL.unknown),
                                day.date === today && 'ring-1 ring-primary/60',
                                isSelected && 'ring-2 ring-primary shadow-md',
                            )}
                        >
                            {Number(day.date.slice(8))}
                            {!future && <span aria-hidden="true" className={cn('absolute bottom-1 size-1 rounded-full', DOT[key] ?? DOT.unknown)} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AttendanceTab({ child, today }: { child: ParentChild; today: string }) {
    const { t } = useTranslation();
    const currentMonth = today.slice(0, 7);
    const [month, setMonth] = useState(currentMonth);
    const [picked, setPicked] = useState<{ month: string; date: string } | null>(null);
    const { data, error } = useMonth(child.personId, month);

    const [year = '', mon = '1'] = month.split('-');
    const present = data ? data.stats.left + data.stats.inside : 0;
    const absent = data?.stats.absent ?? 0;
    const excused = data?.stats.excused ?? 0;
    const percent = data && present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;

    // Tanlangan kun: bosilgani, bo‘lmasa — joriy oyda bugun.
    const selected = picked?.month === month ? picked.date : month === currentMonth ? today : null;
    const selectedDay = data?.days.find((day) => day.date === selected) ?? null;

    const legend = ['left', 'absent', 'excused', 'anomaly', 'day_off'] as const;
    const stats = [
        { key: 'present', value: present, dot: 'bg-success' },
        { key: 'absent', value: absent, dot: 'bg-destructive' },
        { key: 'excused', value: excused, dot: 'bg-info' },
    ];

    return (
        <div className="space-y-4">
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

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {!data && !error && <div className="h-72 animate-pulse rounded-2xl bg-muted/50" aria-busy="true" />}

            {data && (
                <>
                    <Card className="flex-row items-center gap-4 p-4">
                        <Ring percent={percent} />
                        <div className="min-w-0 flex-1">
                            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('parent.monthPercent')}</p>
                            <ul className="list-none space-y-1.5">
                                {stats.map((item) => (
                                    <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <span aria-hidden="true" className={cn('size-2 rounded-full', item.dot)} />
                                            {t(`parent.stats.${item.key}`)}
                                        </span>
                                        <span className="font-bold tabular-nums">{item.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Card>

                    <Card className="gap-3 p-4">
                        <MonthCalendar
                            month={month}
                            days={data.days}
                            today={today}
                            selected={selected}
                            onSelect={(date) => setPicked({ month, date })}
                        />
                        <ul className="flex list-none flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                            {legend.map((key) => (
                                <li key={key} className="flex items-center gap-1.5">
                                    <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[key])} />
                                    {t(`parent.status.${key}`)}
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card className="gap-2 p-4">
                        {selectedDay ? (
                            <>
                                <p className="text-sm font-semibold">{formatDateLong(selectedDay.date)}</p>
                                <StatusBadge tone={TONE[statusKey(selectedDay.status)] ?? 'neutral'} className="w-fit">
                                    {t(`parent.status.${statusKey(selectedDay.status)}`)}
                                </StatusBadge>
                                <TimesLine day={selectedDay} className="text-muted-foreground" />
                                {selectedDay.excuse && (
                                    <p className="text-sm text-muted-foreground">
                                        {t(`parent.reasons.${selectedDay.excuse.reason}`, { defaultValue: selectedDay.excuse.reason })}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('parent.selectDay')}</p>
                        )}
                    </Card>
                </>
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

    const accent: Record<ParentExcuse['status'], string> = {
        PENDING: 'border-l-warning',
        ACTIVE: 'border-l-success',
        REJECTED: 'border-l-destructive',
        CANCELLED: 'border-l-border',
    };

    if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
    if (!items) return <div className="h-32 animate-pulse rounded-2xl bg-muted/50" aria-busy="true" />;
    if (items.length === 0) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t('parent.noExcuses')}</p>;

    return (
        <ul className="list-none space-y-3">
            {items.map((item) => (
                <li key={item.id}>
                    <Card className={cn('gap-2 border-l-4 p-4', accent[item.status])}>
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
                <p className="flex items-center gap-2 text-sm font-semibold">
                    <Languages aria-hidden="true" className="size-4 text-primary" />
                    {t('parent.language')}
                </p>
                <SelectField
                    value={me.language}
                    onValueChange={(value) => void save({ language: value })}
                    options={LANGUAGES}
                    aria-label={t('parent.language')}
                />
            </Card>
            <Card className="gap-1 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <Bell aria-hidden="true" className="size-4 text-primary" />
                    {t('parent.notifications')}
                </p>
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
    const [tab, setTab] = useState<TabKey>('attendance');

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
            <main className="paper mx-auto grid min-h-svh max-w-md place-items-center p-6 text-center text-foreground">
                <p className="text-sm leading-6 text-muted-foreground">{t(`parent.${key}`)}</p>
            </main>
        );
    }

    if (!me) {
        return (
            <main className="paper mx-auto min-h-svh max-w-md p-4" aria-busy="true">
                <div className="h-40 animate-pulse rounded-2xl bg-muted/50" />
            </main>
        );
    }

    const tabs: { key: TabKey; icon: typeof CalendarDays }[] = [
        { key: 'attendance', icon: CalendarDays },
        { key: 'excuses', icon: FileText },
        { key: 'settings', icon: Settings },
    ];

    return (
        <div className="paper min-h-svh text-foreground">
            <div aria-hidden="true" className="fixed inset-x-0 top-0 z-20 h-0.5 bg-brand-gradient" />
            <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-28">
                {me.children.length > 1 && <ChildPicker children={me.children} value={childId} onChange={setChildId} />}
                {child && (tab === 'attendance' ? <Hero key={child.personId} child={child} today={me.today} /> : <ChildStrip child={child} />)}

                <div key={`${tab}:${child?.personId ?? ''}`} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    {tab === 'attendance' && child && <AttendanceTab child={child} today={me.today} />}
                    {tab === 'excuses' && child && <ExcusesTab child={child} />}
                    {tab === 'settings' && <SettingsTab me={me} onChange={apply} />}
                </div>
            </main>

            <nav aria-label={t('parent.title')} className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
                <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
                    {tabs.map(({ key, icon: Icon }) => {
                        const active = tab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                aria-current={active ? 'page' : undefined}
                                onClick={() => setTab(key)}
                                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold"
                            >
                                <span
                                    className={cn(
                                        'grid h-8 w-14 place-items-center rounded-full transition-colors',
                                        active ? 'bg-brand-gradient text-white shadow-md' : 'text-muted-foreground',
                                    )}
                                >
                                    <Icon aria-hidden="true" className="size-5" />
                                </span>
                                <span className={cn('max-w-full truncate', active ? 'text-foreground' : 'text-muted-foreground')}>{t(`parent.tabs.${key}`)}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
