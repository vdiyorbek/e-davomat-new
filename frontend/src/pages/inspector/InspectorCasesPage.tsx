import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { InspectorCaseDialog } from '@/components/inspector/InspectorCaseDialog';
import { InspectorCasePdf } from '@/components/inspector/InspectorCasePdf';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate } from '@/lib/date';
import type { CaseOutcome, InspectorCasesResponse } from '@/types/inspector';

const ALL = 'ALL';
const LIMIT = 20;

const OUTCOME_TONES: Record<CaseOutcome, StatusTone> = {
    RETURNED: 'success',
    EXCUSED: 'primary',
    REFERRED: 'info',
    TRANSFERRED: 'neutral',
    STILL_ABSENT: 'danger',
};

function fullName(p: { lastName: string; firstName: string; middleName: string | null }) {
    return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

/** Uchastkavoyning barcha o‘rganish ishlari va ularning PDF hisobotlari. */
export function InspectorCasesPage() {
    const { t } = useTranslation();
    const [status, setStatus] = useState(ALL);
    const [page, setPage] = useState(1);
    const [caseId, setCaseId] = useState<number | null>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [notice, setNotice] = useState('');

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status !== ALL) params.set('status', status);
    const query = useApiQuery<InspectorCasesResponse>(`/inspectors/me/cases?${params.toString()}`);
    const data = query.data;

    return (
        <div className="space-y-6">
            <PageHeader title={t('inspectors.cases.title')} description={t('inspectors.cases.description')} />
            {notice && <SuccessNotice>{notice}</SuccessNotice>}

            <Card className="p-4 sm:p-5">
                <div className="flex max-w-xs flex-col gap-1.5 text-sm font-semibold">
                    {t('inspectors.cases.statusFilter')}
                    <SelectField
                        value={status}
                        onValueChange={(value) => {
                            setStatus(value);
                            setPage(1);
                        }}
                        aria-label={t('inspectors.cases.statusFilter')}
                        options={[
                            { value: ALL, label: t('inspectors.cases.statusAll') },
                            { value: 'OPEN', label: t('inspectors.cases.status.OPEN') },
                            { value: 'CLOSED', label: t('inspectors.cases.status.CLOSED') },
                        ]}
                    />
                </div>
            </Card>

            {query.loading && <LoadingState />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {data && data.items.length === 0 && (
                <EmptyState title={t('inspectors.cases.emptyTitle')} description={t('inspectors.cases.empty')} />
            )}

            {data && data.items.length > 0 && (
                <>
                    <Card className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">№</TableHead>
                                    <TableHead>{t('inspectors.students.name')}</TableHead>
                                    <TableHead>{t('inspectors.absentees.absence')}</TableHead>
                                    <TableHead>{t('inspectors.cases.fields.visitDate')}</TableHead>
                                    <TableHead>{t('inspectors.cases.result')}</TableHead>
                                    <TableHead className="pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="pl-5 tabular-nums">{item.id}</TableCell>
                                        <TableCell>
                                            <span className="font-medium">{fullName(item)}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {item.school}
                                                {item.className ? `, ${item.className}` : ''}
                                            </span>
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {t('inspectors.absentees.days', { count: item.absentDays })}
                                            <span className="block text-xs text-muted-foreground">
                                                {t('inspectors.absentees.since', { date: formatDate(item.absentSince) })}
                                            </span>
                                        </TableCell>
                                        <TableCell>{formatDate(item.visitDate, '—')}</TableCell>
                                        <TableCell>
                                            {item.status === 'OPEN' ? (
                                                <StatusBadge tone="warning">{t('inspectors.cases.status.OPEN')}</StatusBadge>
                                            ) : (
                                                <StatusBadge tone={item.outcome ? OUTCOME_TONES[item.outcome] : 'neutral'}>
                                                    {item.outcome ? t(`inspectors.cases.outcome.${item.outcome}`) : '—'}
                                                </StatusBadge>
                                            )}
                                            {item.followUpDate && (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {t('inspectors.cases.followUpOn', { date: formatDate(item.followUpDate) })}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setCaseId(item.id)}>
                                                    {item.status === 'OPEN' ? t('inspectors.absentees.continue') : t('inspectors.cases.view')}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setPdfId(item.id)}>
                                                    <FileText aria-hidden="true" />
                                                    PDF
                                                </Button>
                                            </div>
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
            {pdfId !== null && <InspectorCasePdf caseId={pdfId} open onOpenChange={(open) => !open && setPdfId(null)} />}
        </div>
    );
}
