import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LogIn, LogOut } from 'lucide-react';

import { AttendancePhoto } from './AttendancePhoto';
import { cn } from '@/lib/utils';

import type { AttendancePhotoStatus, DailyAttendance } from '@/types/daily-attendance';

const LOCALES: Record<string, string> = { uz: 'uz-UZ', 'uz-Cyrl': 'uz-Cyrl-UZ', ru: 'ru-RU', en: 'en-GB' };

/** Kun chizig'i: 06:00 dan 20:00 gacha (Toshkent vaqti) */
const DAY_START = 6 * 60;
const DAY_END = 20 * 60;

function tashkentMinutes(value: string | null): number | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Tashkent',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return get('hour') * 60 + get('minute');
}

function percent(minutes: number): number {
    const clamped = Math.min(Math.max(minutes, DAY_START), DAY_END);
    return ((clamped - DAY_START) / (DAY_END - DAY_START)) * 100;
}

function DayBar({ inTime, outTime }: { inTime: string | null; outTime: string | null }) {
    const a = tashkentMinutes(inTime);
    const b = tashkentMinutes(outTime);

    return (
        <div aria-hidden="true">
            <div className="relative h-2.5 rounded-full bg-muted">
                {a !== null && b !== null && b > a && (
                    <span
                        className="absolute inset-y-0 rounded-full bg-success/35"
                        style={{ left: `${percent(a)}%`, width: `${percent(b) - percent(a)}%` }}
                    />
                )}
                {a !== null && (
                    <span
                        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-success"
                        style={{ left: `${percent(a)}%` }}
                    />
                )}
                {b !== null && (
                    <span
                        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-warning"
                        style={{ left: `${percent(b)}%` }}
                    />
                )}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-muted-foreground">
                <span>06:00</span>
                <span>13:00</span>
                <span>20:00</span>
            </div>
        </div>
    );
}

function PhotoPlaceholder({ time, status }: { time: string | null; status: AttendancePhotoStatus | null }) {
    const { t } = useTranslation();
    let text = t('attendance.noPhoto');
    if (!time) text = t('attendance.noEvent');
    else if (status === 'PENDING') text = t('attendance.photoPending');
    else if (status === 'FAILED') text = t('attendance.photoFailed');

    return (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 p-3 text-center text-xs text-muted-foreground">
            {text}
        </div>
    );
}

export function AttendanceCard({ item }: { item: DailyAttendance }) {
    const { t, i18n } = useTranslation();
    const locale = LOCALES[i18n.resolvedLanguage ?? 'uz'] ?? 'uz-UZ';

    function formatTime(value: string | null): string {
        if (!value) return t('attendance.notRecorded');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return t('attendance.badTime');
        return new Intl.DateTimeFormat(locale, {
            timeZone: 'Asia/Tashkent',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).format(date);
    }

    const fullName = item.person
        ? [item.person.lastName, item.person.firstName, item.person.middleName].filter(Boolean).join(' ')
        : t('attendance.noPerson');
    const initials = item.person
        ? `${item.person.firstName.charAt(0)}${item.person.lastName.charAt(0)}`.toUpperCase()
        : '?';

    const status = item.attendanceStatus;
    const newStatusLabels: Record<string, string> = {
        day_off: 'Dam olish kuni',
        unconfigured: 'Jadval sozlanmagan',
        conflict: 'Kalendar ziddiyati',
    };
    const statusStyle = {
        inside: 'bg-success/15 text-success',
        left: 'bg-warning/20 text-foreground',
        excused: 'bg-primary/10 text-primary',
        absent: 'bg-destructive/10 text-destructive',
        anomaly: 'bg-muted text-muted-foreground',
        day_off: 'bg-muted text-muted-foreground',
        unconfigured: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        conflict: 'bg-destructive/10 text-destructive',
    }[status];
    const stripe = {
        inside: 'bg-success',
        left: 'bg-warning',
        excused: 'bg-primary',
        absent: 'bg-destructive',
        anomaly: 'bg-border',
        day_off: 'bg-muted-foreground',
        unconfigured: 'bg-amber-500',
        conflict: 'bg-destructive',
    }[status];

    const moments = [
        { key: 'in', label: t('attendance.firstIn'), icon: LogIn, time: item.firstInTime, url: item.firstInUrl, status: item.firstInPhotoStatus },
        { key: 'out', label: t('attendance.lastOut'), icon: LogOut, time: item.lastOutTime, url: item.lastOutUrl, status: item.lastOutPhotoStatus },
    ];

    return (
        <article className="relative min-w-0 space-y-5 overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm shadow-primary/[0.04] transition-shadow hover:shadow-md motion-reduce:transition-none">
            <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', stripe)} />

            <div className="flex items-start gap-3 pl-1.5">
                <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="break-words font-heading text-base font-bold leading-snug">
                        {item.person ? (
                            <Link to={`/persons/${item.person.id}`} className="underline-offset-4 hover:underline">
                                {fullName}
                            </Link>
                        ) : (
                            fullName
                        )}
                    </h2>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{t('attendance.pnfl')}: {item.pnfl}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', statusStyle)}>
                    {t(`attendance.status.${status}`, {
                        defaultValue: newStatusLabels[status] ?? status,
                    })}
                </span>
            </div>

            <div className="pl-1.5">
                <p className="break-words text-sm font-semibold">{item.school.name}</p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {item.region.name} / {item.district.name}
                </p>
            </div>

            <div className="pl-1.5">
                <DayBar inTime={item.firstInTime} outTime={item.lastOutTime} />
            </div>

            <div className="grid grid-cols-2 gap-3 pl-1.5">
                {moments.map((moment) => (
                    <div key={moment.key} className="min-w-0 space-y-2">
                        <div>
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <moment.icon aria-hidden="true" className="size-3.5" />
                                {moment.label}
                            </p>
                            <p className="mt-1 text-base font-bold tabular-nums">{formatTime(moment.time)}</p>
                        </div>
                        {moment.url ? (
                            <AttendancePhoto key={moment.url} url={moment.url} alt={`${fullName} — ${moment.label}`} />
                        ) : (
                            <PhotoPlaceholder time={moment.time} status={moment.status} />
                        )}
                    </div>
                ))}
            </div>
        </article>
    );
}
