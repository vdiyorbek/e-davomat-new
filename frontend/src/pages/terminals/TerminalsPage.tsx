import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, MapPin, Plus, RotateCw, ScanFace } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CheckTerminalButton } from '@/components/terminals/CheckTerminalButton';
import { CreateTerminalForm } from '@/components/terminals/CreateTerminalForm';
import { StartTerminalSyncForm } from '@/components/terminals/StartTerminalSyncForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/date';
import type { Terminal, TerminalsPageResponse } from '@/types/terminal';

function syncTone(terminal: Terminal) {
    if (!terminal.isActive) return 'neutral' as const;
    if (terminal.eventsSyncedUntil) return 'success' as const;
    if (terminal.syncStartAt) return 'warning' as const;
    return 'neutral' as const;
}

function TerminalCard({ terminal, canManage, onChanged }: { terminal: Terminal; canManage: boolean; onChanged: () => void }) {
    const { t } = useTranslation();
    const never = t('terminals.never');
    const DirectionIcon = terminal.direction === 'IN' ? ArrowDownToLine : ArrowUpFromLine;
    const address = `${terminal.protocol.toLowerCase()}://${terminal.host.includes(':') ? `[${terminal.host}]` : terminal.host}:${terminal.port}`;

    const syncText = !terminal.syncStartAt
        ? t('terminals.syncState.notStarted')
        : !terminal.isActive
            ? t('terminals.syncState.disabled')
            : terminal.eventsSyncedUntil
                ? t('terminals.syncState.running')
                : t('terminals.syncState.pending');

    return (
        <Card className="h-full min-w-0 gap-4">
            <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <ScanFace aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="font-heading font-semibold [overflow-wrap:anywhere]">{terminal.name}</h2>
                            <p className="truncate font-mono text-xs text-muted-foreground">{address}</p>
                        </div>
                    </div>
                    <StatusBadge tone={terminal.isActive ? 'success' : 'neutral'}>
                        {terminal.isActive ? t('terminals.active') : t('terminals.inactive')}
                    </StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info" dot={false}>
                        <DirectionIcon aria-hidden="true" className="size-3.5" />
                        {t(`terminals.directions.${terminal.direction}`)}
                    </StatusBadge>
                </div>
                <div className="text-sm">
                    <p className="font-medium [overflow-wrap:anywhere]">{terminal.school.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin aria-hidden="true" className="size-3.5" />
                        {terminal.school.region.name} / {terminal.school.district.name}
                    </p>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-1 flex-col gap-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t('terminals.model')}</dt>
                        <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{terminal.model || t('terminals.unknown')}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t('terminals.lastCheck')}</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatDateTime(terminal.lastCheckedAt, never)}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t('terminals.syncStart')}</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatDateTime(terminal.syncStartAt, t('common.notSet'))}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{t('terminals.syncedUntil')}</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatDateTime(terminal.eventsSyncedUntil, never)}</dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                        <dt className="text-xs text-muted-foreground">{t('terminals.lastSync')}</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatDateTime(terminal.lastSuccessfulSyncAt, never)}</dd>
                    </div>
                </dl>

                <div className="mt-auto space-y-3">
                    {terminal.syncStartAt || !canManage ? (
                        <StatusBadge tone={syncTone(terminal)} className="h-auto py-1 whitespace-normal">
                            {syncText}
                        </StatusBadge>
                    ) : (
                        <StartTerminalSyncForm terminalId={terminal.id} isActive={terminal.isActive} onStarted={onChanged} />
                    )}
                    {canManage && <CheckTerminalButton terminalId={terminal.id} />}
                </div>
            </CardContent>
        </Card>
    );
}

function TerminalsResults({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<TerminalsPageResponse>(`/terminals?page=${page}&limit=12`);
    const { session } = useAuth();
    const canManage = session?.profile.role === 'SUPER_ADMIN';

    if (loading) return <LoadingState label={t('terminals.loading')} />;
    if (error || !data) return <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />;

    if (data.data.length === 0) {
        return (
            <EmptyState
                icon={ScanFace}
                title={t('terminals.emptyTitle')}
                description={t('terminals.empty')}
                action={
                    page > 1 ? (
                        <Button variant="outline" onClick={() => onPageChange(1)}>
                            {t('common.pagination.firstPage')}
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('terminals.total', { count: data.total })}</p>
                <Button variant="outline" size="sm" onClick={retry}>
                    <RotateCw aria-hidden="true" />
                    {t('common.refresh')}
                </Button>
            </div>
            <ul className="grid list-none gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {data.data.map((terminal) => (
                    <li key={terminal.id} className="min-w-0">
                        <TerminalCard terminal={terminal} canManage={canManage} onChanged={retry} />
                    </li>
                ))}
            </ul>
            <Pagination
                page={data.page}
                totalPages={Math.max(1, data.totalPages)}
                onPageChange={onPageChange}
                total={data.total}
                pageSize={data.limit}
                shownCount={data.data.length}
            />
        </div>
    );
}

export function TerminalsPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [success, setSuccess] = useState('');
    const canCreate = session?.profile.role === 'SUPER_ADMIN';

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.system')}
                title={t('terminals.title')}
                description={t('terminals.subtitle')}
                actions={
                    canCreate ? (
                        <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setSuccess('');
                                setShowCreate(true);
                            }}
                        >
                            <Plus aria-hidden="true" />
                            {t('terminals.add')}
                        </Button>
                    ) : undefined
                }
            />

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <TerminalsResults key={`${page}-${refreshVersion}`} page={page} onPageChange={setPage} />

            {canCreate && (
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('terminals.form.title')}</DialogTitle>
                            <DialogDescription>{t('terminals.form.description')}</DialogDescription>
                        </DialogHeader>
                        <CreateTerminalForm
                            onCancel={() => setShowCreate(false)}
                            onSaved={() => {
                                setShowCreate(false);
                                setSuccess(t('terminals.saved'));
                                setPage(1);
                                setRefreshVersion((value) => value + 1);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
