import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { InspectorTalkEditForm } from '@/components/inspector/InspectorTalkEditForm';
import { InspectorTalkPdf } from '@/components/inspector/InspectorTalkPdf';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedDelete } from '@/lib/auth-session';
import { formatDate } from '@/lib/date';
import { TALK_RESULTS } from '@/types/inspector';
import type { InspectorTalkItem, InspectorTalksResponse, TalkResult } from '@/types/inspector';

const ALL = 'ALL';
const LIMIT = 20;

const RESULT_TONES: Record<TalkResult, StatusTone> = {
    SOLVED: 'success',
    RECHECK: 'warning',
    REFERRED: 'info',
};

function fullName(p: { lastName: string; firstName: string; middleName: string | null }) {
    return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

export function InspectorTalksPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const isInspector = session?.profile.role === 'MAHALLA_INSPECTOR';
    const { confirm, dialog } = useConfirm();

    const [result, setResult] = useState<string>(ALL);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState<InspectorTalkItem | null>(null);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (result !== ALL) params.set('result', result);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    const query = useApiQuery<InspectorTalksResponse>(`/inspectors/talks?${params.toString()}`);
    const data = query.data;

    async function handleDelete(talk: InspectorTalkItem) {
        setActionError('');
        const ok = await confirm({
            title: t('inspectors.talks.deleteTitle'),
            description: t('inspectors.talks.deleteDescription'),
            confirmLabel: t('inspectors.talks.delete'),
            destructive: true,
        });
        if (!ok) return;

        try {
            await authorizedDelete(`/inspectors/me/talks/${talk.id}`);
            setNotice(t('inspectors.talks.deleted'));
            query.retry();
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : t('common.loadFailed'));
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader title={t('inspectors.talks.title')} description={t('inspectors.talks.description')} />

            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {actionError && <ErrorState message={actionError} />}

            <Card className="p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.talks.dateFrom')}
                        <Input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(event) => {
                                setDateFrom(event.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.talks.dateTo')}
                        <Input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(event) => {
                                setDateTo(event.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                    <div className="flex flex-col gap-1.5 text-sm font-semibold">
                        {t('inspectors.talks.result')}
                        <SelectField
                            value={result}
                            onValueChange={(value) => {
                                setResult(value);
                                setPage(1);
                            }}
                            aria-label={t('inspectors.talks.result')}
                            options={[
                                { value: ALL, label: t('inspectors.talks.allResults') },
                                ...TALK_RESULTS.map((value) => ({
                                    value,
                                    label: t(`inspectors.talk.resultOptions.${value}`),
                                })),
                            ]}
                        />
                    </div>
                </div>
            </Card>

            {isInspector && <p className="text-sm text-muted-foreground">{t('inspectors.talks.editHint')}</p>}

            {query.loading && <LoadingState />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}

            {data && data.items.length === 0 && (
                <EmptyState title={t('inspectors.talks.emptyTitle')} description={t('inspectors.talks.empty')} />
            )}

            {data && data.items.length > 0 && (
                <>
                    <Card className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">{t('inspectors.talks.date')}</TableHead>
                                    <TableHead>{t('inspectors.talks.student')}</TableHead>
                                    <TableHead>{t('inspectors.talks.spokeWith')}</TableHead>
                                    <TableHead>{t('inspectors.talks.reason')}</TableHead>
                                    <TableHead>{t('inspectors.talks.result')}</TableHead>
                                    <TableHead>{t('inspectors.talks.inspector')}</TableHead>
                                    <TableHead>{t('inspectors.talks.followUp')}</TableHead>
                                    <TableHead className="pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((talk) => (
                                    <TableRow key={talk.id}>
                                        <TableCell className="pl-5 whitespace-nowrap">{formatDate(talk.talkDate)}</TableCell>
                                        <TableCell className="font-medium">{fullName(talk.person)}</TableCell>
                                        <TableCell>{t(`inspectors.talk.spokeWithOptions.${talk.spokeWith}`)}</TableCell>
                                        <TableCell className="max-w-64 [overflow-wrap:anywhere]">{talk.reason}</TableCell>
                                        <TableCell>
                                            <StatusBadge tone={RESULT_TONES[talk.result]}>
                                                {t(`inspectors.talk.resultOptions.${talk.result}`)}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell>
                                            {[talk.inspector.lastName, talk.inspector.firstName].filter(Boolean).join(' ')}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {talk.followUpDate ? formatDate(talk.followUpDate) : '—'}
                                        </TableCell>
                                        <TableCell className="pr-5">
                                            <div className="flex justify-end gap-2">
                                                <InspectorTalkPdf talkId={talk.id} />
                                                {talk.canModify && (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="outline"
                                                            aria-label={t('inspectors.talks.edit')}
                                                            onClick={() => {
                                                                setNotice('');
                                                                setEditing(talk);
                                                            }}
                                                        >
                                                            <Pencil aria-hidden="true" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="outline"
                                                            aria-label={t('inspectors.talks.delete')}
                                                            onClick={() => void handleDelete(talk)}
                                                        >
                                                            <Trash2 aria-hidden="true" />
                                                        </Button>
                                                    </>
                                                )}
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

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('inspectors.talks.editTitle')}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <InspectorTalkEditForm
                            key={editing.id}
                            talk={editing}
                            onCancel={() => setEditing(null)}
                            onSaved={() => {
                                setEditing(null);
                                setNotice(t('inspectors.talks.updated'));
                                query.retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {dialog}
        </div>
    );
}