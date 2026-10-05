import { useTranslation } from 'react-i18next';

type Status = 'present' | 'late' | 'absent' | 'empty';

const statuses: Record<
    Status,
    { symbol: string; className: string }
> = {
    present: {
        symbol: '✓',
        className: 'bg-success text-slate-900',
    },
    late: {
        symbol: '◷',
        className: 'bg-warning text-slate-900',
    },
    absent: {
        symbol: '×',
        className: 'bg-destructive text-slate-900',
    },
    empty: {
        symbol: '—',
        className: 'bg-white/10 text-white/60',
    },
};

const students: { name: string; days: Status[] }[] = [
    {
        name: 'Aliyev A.',
        days: ['present', 'present', 'present', 'late', 'present', 'empty'],
    },
    {
        name: 'Karimova N.',
        days: ['present', 'absent', 'present', 'present', 'present', 'empty'],
    },
    {
        name: 'Yusupov S.',
        days: ['present', 'present', 'late', 'present', 'present', 'empty'],
    },
    {
        name: 'Rahimova D.',
        days: ['present', 'present', 'present', 'present', 'absent', 'empty'],
    },
];

export function AttendancePreview() {
    const { t } = useTranslation();
    const days = t('preview.days', { returnObjects: true }) as string[];
    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 xl:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 text-sm">
                <p className="font-semibold text-white">
                    {t('preview.title')}
                </p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                    {t('preview.sample')}
                </span>
            </div>

            <table className="w-full table-fixed border-separate border-spacing-1.5 text-sm">
                <caption className="sr-only">
                    {t('preview.caption')}
                </caption>
                <thead>
                    <tr>
                        <th scope="col" className="w-[27%]">
                            <span className="sr-only">{t('preview.student')}</span>
                        </th>
                        {days.map((day) => (
                            <th
                                key={day}
                                scope="col"
                                className="pb-2 text-center font-normal text-white/50"
                            >
                                {day}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {students.map((student) => (
                        <tr key={student.name}>
                            <th
                                scope="row"
                                className="text-left text-xs font-normal text-white/80 xl:text-sm"
                            >
                                {student.name}
                            </th>
                            {student.days.map((status, index) => {
                                const item = statuses[status];

                                return (
                                    <td key={days[index]} className="p-0">
                                        <span
                                            title={t(`preview.${status}`)}
                                            className={`flex h-8 items-center justify-center rounded-lg text-lg font-semibold xl:h-9 ${item.className}`}
                                        >
                                            <span aria-hidden="true">{item.symbol}</span>
                                            <span className="sr-only">{t(`preview.${status}`)}</span>
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs text-white/70">
                {(['present', 'late', 'absent'] as const).map((status) => (
                    <span key={status} className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className={`size-2.5 rounded-full ${statuses[status].className}`}
                        />
                        {t(`preview.${status}`)}
                    </span>
                ))}
            </div>
        </div>
    );
}