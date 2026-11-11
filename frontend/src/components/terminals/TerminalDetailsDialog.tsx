import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    Activity,
    AlertTriangle,
    Archive,
    ArchiveRestore,
    GitCompareArrows,
    Info,
    Pencil,
    RefreshCw,
    ScanFace,
    Users,
} from 'lucide-react';
import { TerminalClearPersonsAction } from './TerminalClearPersonsAction';
import { useTranslation } from 'react-i18next';
import { TerminalStatusTimeline } from './TerminalStatusTimeline';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedGet } from '@/lib/auth-session';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Terminal } from '@/types/terminal';

import { CheckTerminalButton } from './CheckTerminalButton';
import { StatTile } from './StatTile';
import { StartTerminalSyncForm } from './StartTerminalSyncForm';
import { TerminalPhotoStats } from './TerminalPhotoStats';
import { TerminalSyncHistory } from './TerminalSyncHistory';
import { TerminalSyncMonitoring } from './TerminalSyncMonitoring';
import { connectionBadge, isArchived, syncInfo, systemBadge } from './terminal-status';

interface PersonsPreview {
    students: { total: number; withPhoto: number; withoutPhoto: number };
    teachers: { total: number; withPhoto: number; withoutPhoto: number };
    summary: { total: number; withPhoto: number; withoutPhoto: number };
}

interface PersonsCompare {
    databasePersons: number;
    terminalPersons: number;
    matched: number;
    missingOnTerminal: number;
    extraOnTerminal: number;
    invalidEmployeeNo: number;
}

/** Ta’riflar ro‘yxati bloki: chapda nom, o‘ngda qiymat. */
function InfoList({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="min-w-0 rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-semibold">{title}</h3>
            <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2.5 text-sm">{children}</dl>
        </section>
    );
}

function InfoRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('min-w-0 font-medium break-words', mono && 'font-mono text-xs leading-5 break-all')}>
                {children}
            </dd>
        </>
    );
}

function PersonsSummary({ terminalId }: { terminalId: number }) {
    const { t } = useTranslation();
    const preview = useApiQuery<PersonsPreview>(`/terminals/${terminalId}/person-sync/preview`);
    const [compare, setCompare] = useState<PersonsCompare | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function handleCompare() {
        if (busy) return;
        setBusy(true);
        setError('');
        setCompare(null);
        try {
            setCompare(await authorizedGet<PersonsCompare>(`/terminals/${terminalId}/person-sync/compare`));
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.persons.compareFailed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{t('terminals.persons.title')}</h3>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={preview.retry}
                        disabled={preview.loading || preview.refreshing}
                    >
                        <RefreshCw aria-hidden="true" className={cn(preview.refreshing && 'animate-spin')} />
                        {t('common.refresh')}
                    </Button>
                </div>

                {preview.loading && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-busy="true">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-[72px] rounded-xl" />
                        ))}
                    </div>
                )}
                {preview.error && (
                    <p role="alert" className="text-sm text-destructive">{preview.error}</p>
                )}
                {preview.data && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile label={t('terminals.persons.students')} value={preview.data.students.total} />
                        <StatTile label={t('terminals.persons.teachers')} value={preview.data.teachers.total} />
                        <StatTile label={t('terminals.persons.withPhoto')} value={preview.data.summary.withPhoto} tone="success" />
                        <StatTile
                            label={t('terminals.persons.withoutPhoto')}
                            value={preview.data.summary.withoutPhoto}
                            tone={preview.data.summary.withoutPhoto > 0 ? 'warning' : undefined}
                        />
                    </div>
                )}
            </section>

            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{t('terminals.persons.compareTitle')}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('terminals.persons.note')}</p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={busy || preview.loading || !preview.data}
                        onClick={() => void handleCompare()}
                    >
                        <GitCompareArrows aria-hidden="true" />
                        {busy ? t('terminals.persons.comparing') : t('terminals.persons.compare')}
                    </Button>
                </div>

                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {compare && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile label={t('terminals.persons.onTerminal')} value={compare.terminalPersons} />
                        <StatTile label={t('terminals.persons.matched')} value={compare.matched} tone="success" />
                        <StatTile
                            label={t('terminals.persons.missing')}
                            value={compare.missingOnTerminal}
                            tone={compare.missingOnTerminal > 0 ? 'danger' : undefined}
                        />
                        <StatTile
                            label={t('terminals.persons.extra')}
                            value={compare.extraOnTerminal}
                            tone={compare.extraOnTerminal > 0 ? 'warning' : undefined}
                        />
                    </div>
                )}
            </section>
        </div>
    );
}

interface Props {
    terminal: Terminal;
    canManage: boolean;
    now: number;
    onClose: () => void;
    onChanged: () => void;
    onEdit: (terminal: Terminal) => void;
    onArchiveAction: (terminal: Terminal) => void;
}

export function TerminalDetailsDialog({ terminal, canManage, now, onClose, onChanged, onEdit, onArchiveAction }: Props) {
    const { t } = useTranslation();
    const archived = isArchived(terminal);
    const connection = connectionBadge(terminal, t);
    const system = systemBadge(terminal, t);
    const sync = syncInfo(terminal, now, t);
    const showDiagnostics = canManage && !archived;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 text-left sm:px-6">
                    <div className="flex items-start gap-3 pr-8">
                        <span
                            aria-hidden="true"
                            className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-md shadow-gradient-to/25"
                        >
                            <ScanFace className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle className="flex flex-wrap items-baseline gap-x-2 text-lg leading-tight">
                                <span className="break-words">{terminal.name}</span>
                                <span className="font-mono text-sm font-normal text-muted-foreground">#{terminal.id}</span>
                            </DialogTitle>
                            <DialogDescription className="mt-1 break-words">
                                {terminal.school.region.name} / {terminal.school.district.name} / {terminal.school.name}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <StatusBadge tone={terminal.direction === 'IN' ? 'success' : 'primary'} dot={false}>
                            {t(`terminals.directions.${terminal.direction}`)}
                        </StatusBadge>
                        <StatusBadge tone={connection.tone}>{connection.text}</StatusBadge>
                        <StatusBadge tone={system.tone} dot={false}>{system.text}</StatusBadge>
                        <StatusBadge tone={sync.tone}>
                            {sync.text}
                            {sync.delay && <span className="font-normal opacity-80">· {sync.delay}</span>}
                        </StatusBadge>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
                    <div className="shrink-0 border-b px-5 py-3 sm:px-6">
                        <TabsList className="w-full sm:w-fit">
                            <TabsTrigger value="overview">
                                <Info aria-hidden="true" />
                                {t('terminals.details.tabs.overview')}
                            </TabsTrigger>
                            {!archived && (
                                <TabsTrigger value="persons">
                                    <Users aria-hidden="true" />
                                    {t('terminals.details.tabs.persons')}
                                </TabsTrigger>
                            )}
                            {showDiagnostics && (
                                <TabsTrigger value="diagnostics">
                                    <Activity aria-hidden="true" />
                                    {t('terminals.details.tabs.diagnostics')}
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <TabsContent value="overview" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoList title={t('terminals.details.device')}>
                                    <InfoRow label={t('terminals.details.address')} mono>
                                        {terminal.host}:{terminal.port}
                                    </InfoRow>
                                    <InfoRow label={t('terminals.details.protocol')}>{terminal.protocol}</InfoRow>
                                    <InfoRow label={t('terminals.details.login')}>{terminal.username}</InfoRow>
                                    <InfoRow label={t('terminals.model')}>{terminal.model ?? '—'}</InfoRow>
                                    <InfoRow label={t('terminals.serial')} mono>{terminal.serialNumber ?? '—'}</InfoRow>
                                </InfoList>
                                <InfoList title={t('terminals.details.status')}>
                                    <InfoRow label={t('terminals.lastCheck')}>{formatDateTime(terminal.lastCheckedAt)}</InfoRow>
                                    <InfoRow label={t('terminals.details.lastSeen')}>{formatDateTime(terminal.lastSeenAt)}</InfoRow>
                                    <InfoRow label={t('terminals.details.syncStarted')}>{formatDateTime(terminal.syncStartAt)}</InfoRow>
                                    <InfoRow label={t('terminals.details.eventsUntil')}>{formatDateTime(terminal.eventsSyncedUntil)}</InfoRow>
                                    <InfoRow label={t('terminals.details.lastSync')}>{formatDateTime(terminal.lastSuccessfulSyncAt)}</InfoRow>
                                </InfoList>
                            </div>
                            {!archived && <TerminalStatusTimeline terminalId={terminal.id} />}
                            {archived && (
                                <Alert>
                                    <Archive aria-hidden="true" />
                                    <AlertDescription>{t('terminals.details.archivedNote')}</AlertDescription>
                                </Alert>
                            )}
                            {terminal.healthStatus === 'OFFLINE' && terminal.lastError && (
                                <Alert variant="destructive">
                                    <AlertTriangle aria-hidden="true" />
                                    <AlertTitle>{t('terminals.details.lastError')}</AlertTitle>
                                    <AlertDescription className="break-words [overflow-wrap:anywhere]">
                                        {terminal.lastError}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {!archived && terminal.isActive && terminal.healthStatus === 'UNKNOWN' && (
                                <p className="text-xs text-muted-foreground">{t('terminals.details.staleCheck')}</p>
                            )}

                            {showDiagnostics && (
                                <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                                    <div>
                                        <h3 className="text-sm font-semibold">{t('terminals.details.actionsTitle')}</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">{t('terminals.details.actionsHint')}</p>
                                    </div>
                                    <div className={cn('grid items-start gap-3', !terminal.syncStartAt && 'md:grid-cols-2')}>
                                        <CheckTerminalButton terminalId={terminal.id} />
                                        {!terminal.syncStartAt && (
                                            <StartTerminalSyncForm
                                                terminalId={terminal.id}
                                                isActive={terminal.isActive}
                                                onStarted={() => {
                                                    onChanged();
                                                    onClose();
                                                }}
                                            />
                                        )}
                                    </div>
                                </section>
                            )}

                            {showDiagnostics && terminal.isActive && (
                                <section className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-destructive">
                                            {t('terminals.clearPersons.zoneTitle')}
                                        </h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {t('terminals.clearPersons.zoneHint')}
                                        </p>
                                    </div>
                                    <TerminalClearPersonsAction
                                        terminalId={terminal.id}
                                        terminalName={terminal.name}
                                        onFinished={onChanged}
                                    />
                                </section>
                            )}
                        </TabsContent>

                        {!archived && (
                            <TabsContent value="persons">
                                <PersonsSummary terminalId={terminal.id} />
                            </TabsContent>
                        )}

                        {showDiagnostics && (
                            <TabsContent value="diagnostics" className="space-y-4">
                                <div className="grid items-start gap-4 lg:grid-cols-2">
                                    <TerminalSyncMonitoring terminalId={terminal.id} />
                                    <TerminalSyncHistory terminalId={terminal.id} />
                                </div>
                                <TerminalPhotoStats terminalId={terminal.id} canManage={canManage} />
                            </TabsContent>
                        )}
                    </div>
                </Tabs>

                <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 sm:justify-between border-t px-5 py-3 sm:px-6">
                    <div className="flex flex-wrap gap-2">
                        {canManage && !archived && (
                            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(terminal)}>
                                <Pencil aria-hidden="true" />
                                {t('terminals.actions.edit')}
                            </Button>
                        )}
                        {canManage && (
                            <Button
                                type="button"
                                variant={archived ? 'outline' : 'destructive'}
                                size="sm"
                                onClick={() => onArchiveAction(terminal)}
                            >
                                {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                                {archived ? t('terminals.actions.restore') : t('terminals.actions.archive')}
                            </Button>
                        )}
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                        {t('common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
