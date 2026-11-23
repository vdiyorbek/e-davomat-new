import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ExportExcelButton } from '@/components/common/ExportExcelButton';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { GuardianContacts } from '@/components/inspector/GuardianContacts';
import { InspectorCaseDialog } from '@/components/inspector/InspectorCaseDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';
import { formatDate, todayInTashkent } from '@/lib/date';
import type { InspectorAbsenteesResponse, InspectorMahalla } from '@/types/inspector';
import { Label } from '@/components/ui/label';

const ALL = 'ALL';
const LIMIT = 20;

function fullName(p: { lastName: string; firstName: string; middleName: string | null }) {
    return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

/** Mahalladagi 5+ kun ketma-ket kelmayotgan o‘quvchilar va ular bo‘yicha o‘rganish ishlari. */
export function InspectorAbsenteesPage() {
    const { t } = useTranslation();
    const [mahallaId, setMahallaId] = useState(ALL);
    const [state, setState] = useState(ALL);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [caseId, setCaseId] = useState<number | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const mahallas = useApiQuery<InspectorMahalla[]>('/inspectors/me/mahallas');
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (mahallaId !== ALL) params.set('mahallaId', mahallaId);
    if (state !== ALL) params.set('state', state);
    if (search) params.set('search', search);
    const exportParams = new URLSearchParams(params);
    exportParams.delete('page');
    exportParams.delete('limit');
    const query = useApiQuery<InspectorAbsenteesResponse>(`/inspectors/me/absentees?${params.toString()}`);
    const data = query.data;

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = searchInput.trim();
        if (value.length === 1) return;
        setSearch(value);
        setPage(1);
    }

    async function startCase(personId: number) {
        setError('');
        setNotice('');
        setBusyId(personId);
        try {
            const created = await authorizedPost<{ id: number }>('/inspectors/me/cases', { personId });
            query.retry();
            setCaseId(created.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common.loadFailed'));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('inspectors.absentees.title')}
                description={t('inspectors.absentees.description', { days: data?.minDays ?? 5 })}
                actions={
                    <ExportExcelButton
                        path={`/inspectors/me/absentees/export?${exportParams.toString()}`}
                        filename={`kelmayotgan-oquvchilar-${todayInTashkent()}.xlsx`}
                    />
                }
            />
            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {error && <ErrorState message={error} />}

            <Card className="p-4 sm:p-5">
                <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        {t('inspectors.absentees.state')}
                        <SelectField
                            value={state}
                            onValueChange={(value) => {
                                setState(value);
                                setPage(1);
                            }}
                            aria-label={t('inspectors.absentees.state')}
                            options={[
                                { value: ALL, label: t('inspectors.absentees.stateAll') },
                                { value: 'NEW', label: t('inspectors.absentees.stateNew') },
                                { value: 'IN_PROGRESS', label: t('inspectors.absentees.stateProgress') },
                            ]}
                        />
                    </div>
                    <Label className="flex flex-col gap-1.5 text-sm font-semibold lg:col-span-2">
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
                    </Label>
                </form>
            </Card>

            {query.loading && <LoadingState />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {data && data.items.length === 0 && (
                <EmptyState title={t('inspectors.absentees.emptyTitle')} description={t('inspectors.absentees.empty')} />
            )}

            {data && data.items.length > 0 && (
                <>
                    <p className="text-xs text-muted-foreground">
                        {t('inspectors.absentees.snapshot', { date: formatDate(data.date) })}
                    </p>
                    <Card className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">{t('inspectors.students.name')}</TableHead>
                                    <TableHead>{t('inspectors.students.school')}</TableHead>
                                    <TableHead>{t('inspectors.students.mahalla')}</TableHead>
                                    <TableHead>{t('inspectors.absentees.absence')}</TableHead>
                                    <TableHead>{t('inspectors.absentees.caseState')}</TableHead>
                                    <TableHead>{t('inspectors.students.guardians')}</TableHead>
                                    <TableHead className="pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((row) => (
                                    <TableRow key={row.personId}>
                                        <TableCell className="pl-5 font-medium">{fullName(row)}</TableCell>
                                        <TableCell>
                                            {row.school.name}
                                            {row.className ? `, ${row.className}` : ''}
                                        </TableCell>
                                        <TableCell>{row.mahalla.name}</TableCell>
                                        <TableCell>
                                            <span className="font-semibold tabular-nums">
                                                {t('inspectors.absentees.days', { count: row.days })}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {t('inspectors.absentees.since', { date: formatDate(row.sinceDate) })}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {row.openCaseId ? (
                                                <StatusBadge tone="warning">{t('inspectors.absentees.stateProgress')}</StatusBadge>
                                            ) : (
                                                <StatusBadge tone="danger">{t('inspectors.absentees.stateNew')}</StatusBadge>
                                            )}
                                            {row.closedCases > 0 && (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {t('inspectors.absentees.earlier', { count: row.closedCases })}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="min-w-56">
                                            <GuardianContacts guardians={row.guardians} />
                                        </TableCell>
                                        <TableCell className="pr-5 text-right">
                                            {row.openCaseId ? (
                                                <Button size="sm" variant="outline" onClick={() => setCaseId(row.openCaseId)}>
                                                    {t('inspectors.absentees.continue')}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={busyId === row.personId}
                                                    onClick={() => void startCase(row.personId)}
                                                >
                                                    {t('inspectors.absentees.start')}
                                                </Button>
                                            )}
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

            <InspectorCaseDialog
                caseId={caseId}
                onClose={() => setCaseId(null)}
                onChanged={(message) => {
                    query.retry();
                    if (message) setNotice(message);
                }}
            />
        </div>
    );
}
