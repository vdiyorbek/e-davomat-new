import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InspectorTalkForm } from '@/components/inspector/InspectorTalkForm';
import type { TalkStudent } from '@/components/inspector/InspectorTalkForm';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatNumber, todayInTashkent } from '@/lib/date';
import { INSPECTOR_STATUSES } from '@/types/inspector';
import type {
    InspectorDayStatus,
    InspectorMahalla,
    InspectorStudentsResponse,
} from '@/types/inspector';

const ALL = 'ALL';
const LIMIT = 20;

const TONES: Record<InspectorDayStatus, StatusTone> = {
    PRESENT: 'success',
    EXCUSED: 'primary',
    ABSENT: 'danger',
    DAY_OFF: 'neutral',
};

export function InspectorStudentsPage() {
    const { t } = useTranslation();
    const today = todayInTashkent();

    const [date, setDate] = useState(today);
    const [mahallaId, setMahallaId] = useState(ALL);
    const [status, setStatus] = useState<string>(ALL);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [talkStudent, setTalkStudent] = useState<TalkStudent | null>(null);
    const [notice, setNotice] = useState('');

    const mahallas = useApiQuery<InspectorMahalla[]>('/inspectors/me/mahallas');

    const params = new URLSearchParams({ date, page: String(page), limit: String(LIMIT) });
    if (mahallaId !== ALL) params.set('mahallaId', mahallaId);
    if (status !== ALL) params.set('status', status);
    if (search) params.set('search', search);

    const query = useApiQuery<InspectorStudentsResponse>(`/inspectors/me/students?${params.toString()}`);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = searchInput.trim();
        if (value.length === 1) return;
        setSearch(value);
        setPage(1);
    }

    function fullName(student: { lastName: string; firstName: string; middleName: string | null }) {
        return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
    }

    const data = query.data;
    const noMahallas = mahallas.data !== null && mahallas.data.length === 0;

    return (
        <div className="space-y-6">
            <PageHeader title={t('inspectors.students.title')} description={t('inspectors.students.description')} />
            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {noMahallas && <ErrorState message={t('inspectors.students.noMahallas')} />}

            <Card className="p-4 sm:p-5">
                <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.students.date')}
                        <Input
                            type="date"
                            value={date}
                            max={today}
                            onChange={(event) => {
                                if (event.target.value) {
                                    setDate(event.target.value);
                                    setPage(1);
                                }
                            }}
                        />
                    </label>

                    <div className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.students.mahalla')}
                        <SelectField
                            value={mahallaId}
                            onValueChange={(value) => {
                                setMahallaId(value);
                                setPage(1);
                            }}
                            aria-label={t('inspectors.students.mahalla')}
                            options={[
                                { value: ALL, label: t('inspectors.students.allMahallas') },
                                ...(mahallas.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.students.status')}
                        <SelectField
                            value={status}
                            onValueChange={(value) => {
                                setStatus(value);
                                setPage(1);
                            }}
                            aria-label={t('inspectors.students.status')}
                            options={[
                                { value: ALL, label: t('inspectors.students.allStatuses') },
                                ...INSPECTOR_STATUSES.map((value) => ({ value, label: t(`inspectors.status.${value}`) })),
                            ]}
                        />
                    </div>

                    <label className="flex flex-col gap-1.5 text-sm font-semibold lg:col-span-2">
                        {t('inspectors.students.search')}
                        <div className="flex gap-2">
                            <Input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder={t('inspectors.students.searchPlaceholder')}
                                maxLength={100}
                            />
                            <Button type="submit">{t('inspectors.students.apply')}</Button>
                        </div>
                    </label>
                </form>
            </Card>

            {data && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {INSPECTOR_STATUSES.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setStatus(status === value ? ALL : value);
                                setPage(1);
                            }}
                            aria-pressed={status === value}
                            className="rounded-2xl border bg-card p-4 text-left transition hover:bg-muted/50 aria-pressed:ring-2 aria-pressed:ring-primary"
                        >
                            <p className="text-sm text-muted-foreground">{t(`inspectors.status.${value}`)}</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(data.counts[value])}</p>
                        </button>
                    ))}
                </div>
            )}

            {query.loading && <LoadingState />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}

            {data && data.items.length === 0 && (
                <EmptyState title={t('inspectors.students.emptyTitle')} description={t('inspectors.students.empty')} />
            )}

            {data && data.items.length > 0 && (
                <>
                    <Card className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">{t('inspectors.students.name')}</TableHead>
                                    <TableHead>{t('inspectors.students.school')}</TableHead>
                                    <TableHead>{t('inspectors.students.mahalla')}</TableHead>
                                    <TableHead>{t('inspectors.students.status')}</TableHead>                                    <TableHead className="pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((student) => (
                                    <TableRow key={student.personId}>
                                        <TableCell className="pl-5 font-medium">{fullName(student)}</TableCell>
                                        <TableCell>
                                            {student.school.name}
                                            {student.schoolClass?.name ? `, ${student.schoolClass.name}` : ''}
                                        </TableCell>
                                        <TableCell>{student.mahalla.name}</TableCell>
                                        <TableCell>
                                            <StatusBadge tone={TONES[student.status]}>
                                                {t(`inspectors.status.${student.status}`)}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="pr-5 text-right">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setNotice('');
                                                    setTalkStudent({
                                                        personId: student.personId,
                                                        name: fullName(student),
                                                        schoolName: student.school.name,
                                                        className: student.schoolClass?.name ?? null,
                                                    });
                                                }}
                                            >
                                                {t('inspectors.talk.add')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    <Pagination
                        page={data.page}
                        totalPages={Math.max(1, Math.ceil(data.total / data.limit))}
                        onPageChange={setPage}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.items.length}
                    />
                </>
            )}
            <Dialog open={talkStudent !== null} onOpenChange={(open) => !open && setTalkStudent(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('inspectors.talk.title')}</DialogTitle>
                        <DialogDescription>{t('inspectors.talk.fileHint', { size: 10 })}</DialogDescription>
                    </DialogHeader>
                    {talkStudent && (
                        <InspectorTalkForm
                            key={talkStudent.personId}
                            student={talkStudent}
                            defaultDate={date}
                            onCancel={() => setTalkStudent(null)}
                            onSaved={() => {
                                setTalkStudent(null);
                                setNotice(t('inspectors.talk.saved'));
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}