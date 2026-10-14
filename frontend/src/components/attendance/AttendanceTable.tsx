
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AttendanceDetailsDialog } from './AttendanceDetailsDialog';

import type {
    AttendanceStatus,
    DailyAttendance,
} from '@/types/daily-attendance';

interface Props {
    items: DailyAttendance[];
    startIndex: number;
}

const STATUS_STYLE: Record<AttendanceStatus, string> = {
    inside: 'bg-success/15 text-success',
    left: 'bg-warning/20 text-foreground',
    excused: 'bg-primary/10 text-primary',
    absent: 'bg-destructive/10 text-destructive',
    anomaly: 'bg-muted text-muted-foreground',
};

const STATUS_FALLBACK: Record<AttendanceStatus, string> = {
    inside: 'Maktabda',
    left: 'Ketgan',
    excused: 'Sababli',
    absent: 'Sababsiz kelmagan',
    anomaly: 'Tekshirish kerak',
};

const LOCALES: Record<string, string> = {
    uz: 'uz-UZ',
    'uz-Cyrl': 'uz-Cyrl-UZ',
    ru: 'ru-RU',
    en: 'en-GB',
};

export function AttendanceTable({
    items,
    startIndex,
}: Props) {
    const { t, i18n } = useTranslation();

    const locale =
        LOCALES[i18n.resolvedLanguage ?? 'uz'] ?? 'uz-UZ';

    function formatTime(value: string | null): string {
        if (!value) return '—';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '—';

        return new Intl.DateTimeFormat(locale, {
            timeZone: 'Asia/Tashkent',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).format(date);
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/60">
                        <tr className="text-xs font-semibold text-muted-foreground">
                            <th scope="col" className="px-4 py-4">№</th>
                            <th scope="col" className="px-4 py-4">F.I.Sh.</th>
                            <th scope="col" className="px-4 py-4">Maktab</th>
                            <th scope="col" className="px-4 py-4">Sinf</th>
                            <th scope="col" className="px-4 py-4">Kirish</th>
                            <th scope="col" className="px-4 py-4">Chiqish</th>
                            <th scope="col" className="px-4 py-4">Holat</th>
                            <th scope="col" className="px-4 py-4">Sabab</th>
                            <th scope="col" className="px-4 py-4 text-right">
                                Amallar
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {items.map((item, index) => {
                            const name = item.person
                                ? [
                                    item.person.lastName,
                                    item.person.firstName,
                                    item.person.middleName,
                                ]
                                    .filter(Boolean)
                                    .join(' ')
                                : t('attendance.noPerson');

                            const statusLabel = t(
                                `attendance.status.${item.attendanceStatus}`,
                                {
                                    defaultValue:
                                        STATUS_FALLBACK[item.attendanceStatus],
                                },
                            );

                            return (
                                <tr
                                    key={item.id}
                                    className="transition-colors hover:bg-muted/35"
                                >
                                    <td className="px-4 py-4 tabular-nums text-muted-foreground">
                                        {startIndex + index}
                                    </td>

                                    <td className="px-4 py-4">
                                        {item.person ? (
                                            <Link
                                                to={`/persons/${item.person.id}`}
                                                className="font-semibold hover:text-primary hover:underline"
                                            >
                                                {name}
                                            </Link>
                                        ) : (
                                            <span>{name}</span>
                                        )}
                                    </td>

                                    <td className="px-4 py-4">
                                        <span className="font-medium">
                                            {item.school.name}
                                        </span>

                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {item.district.name}
                                        </div>
                                    </td>

                                    <td className="px-4 py-4 text-muted-foreground">
                                        —
                                    </td>

                                    <td className="px-4 py-4 font-medium tabular-nums">
                                        {formatTime(item.firstInTime)}
                                    </td>

                                    <td className="px-4 py-4 font-medium tabular-nums">
                                        {formatTime(item.lastOutTime)}
                                    </td>

                                    <td className="px-4 py-4">
                                        <span
                                            className={[
                                                'inline-flex rounded-full px-2.5 py-1',
                                                'whitespace-nowrap text-xs font-semibold',
                                                STATUS_STYLE[item.attendanceStatus],
                                            ].join(' ')}
                                        >
                                            {statusLabel}
                                        </span>
                                    </td>

                                    <td className="px-4 py-4 text-muted-foreground">
                                        —
                                    </td>

                                    <td className="px-4 py-4 text-right">
                                        <AttendanceDetailsDialog item={item} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
