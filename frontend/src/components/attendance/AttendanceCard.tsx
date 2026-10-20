import { LogIn, LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime } from '@/lib/date';
import { personFullName, personInitials } from '@/lib/person';
import { cn } from '@/lib/utils';
import type { AttendancePhotoStatus, DailyAttendance } from '@/types/daily-attendance';

import { AttendancePhoto } from './AttendancePhoto';
import { ATTENDANCE_STRIPE, ATTENDANCE_TONE } from './status';

/** Kun chizig‘i: 06:00 dan 20:00 gacha (Toshkent vaqti) */
const DAY_START = 6 * 60;
const DAY_END = 20 * 60;

function minutesOf(value: string | null): number | null {
    const text = formatTime(value, '');
    if (!text) return null;
    const [hour, minute] = text.split(':').map(Number);
    return hour * 60 + minute;
}

function percent(minutes: number): number {
    const clamped = Math.min(Math.max(minutes, DAY_START), DAY_END);
    return ((clamped - DAY_START) / (DAY_END - DAY_START)) * 100;
}

function DayBar({ inTime, outTime }: { inTime: string | null; outTime: string | null }) {
    const a = minutesOf(inTime);
    const b = minutesOf(outTime);

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
            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
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
    const { t } = useTranslation();
    const fullName = personFullName(item.person, t('attendance.noPerson'));
    const status = item.attendanceStatus;

    const moments = [
        { key: 'in', label: t('attendance.firstIn'), icon: LogIn, time: item.firstInTime, url: item.firstInUrl, status: item.firstInPhotoStatus },
        { key: 'out', label: t('attendance.lastOut'), icon: LogOut, time: item.lastOutTime, url: item.lastOutUrl, status: item.lastOutPhotoStatus },
    ];

    return (
        <article className="relative min-w-0 space-y-5 overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5">
            <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', ATTENDANCE_STRIPE[status])} />

            <div className="flex flex-wrap items-start gap-3 pl-1.5">
                <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {personInitials(item.person)}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base leading-snug font-bold [overflow-wrap:anywhere]">
                        {item.person ? (
                            <Link to={`/persons/${item.person.id}`} className="underline-offset-4 hover:underline">
                                {fullName}
                            </Link>
                        ) : (
                            fullName
                        )}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {t('common.pnfl')}: {item.pnfl}
                    </p>
                </div>
                <StatusBadge tone={ATTENDANCE_TONE[status]}>{t(`attendance.status.${status}`)}</StatusBadge>
            </div>

            <div className="pl-1.5">
                <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                    {item.school.name}
                    {item.className && <span className="font-normal text-muted-foreground"> · {item.className}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
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
                            <p className="mt-1 text-base font-bold tabular-nums">
                                {formatTime(moment.time, t('attendance.notRecorded'))}
                            </p>
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
