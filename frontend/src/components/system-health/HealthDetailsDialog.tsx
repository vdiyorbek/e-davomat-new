import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime, formatNumber } from '@/lib/date';

import type { DetailKey } from './detail-keys';


function ago(minutes: number | null, t: TFunction): string {
    if (minutes === null) return t('systemHealth.details.never');
    if (minutes >= 1440) return t('systemHealth.details.ago.days', { n: Math.floor(minutes / 1440) });
    if (minutes >= 60) return t('systemHealth.details.ago.hours', { n: Math.floor(minutes / 60) });
    return t('systemHealth.details.ago.minutes', { n: minutes });
}

function bytes(value: number, t: TFunction): string {
    if (value >= 1024 ** 3) return `${formatNumber(Math.round((value / 1024 ** 3) * 10) / 10)} ${t('systemHealth.details.unitsBytes.gb')}`;
    if (value >= 1024 ** 2) return `${formatNumber(Math.round(value / 1024 ** 2))} ${t('systemHealth.details.unitsBytes.mb')}`;
    return `${formatNumber(Math.round(value / 1024))} ${t('systemHealth.details.unitsBytes.kb')}`;
}

function TerminalLink({ id, name, host }: { id: number; name: string; host: string }) {
    const { t } = useTranslation();
    return (
        <span className="block min-w-0">
            <span className="font-medium [overflow-wrap:anywhere]">{name}</span>
            <span className="block font-mono text-xs text-muted-foreground">
                #{id} · {host}
            </span>
            <Button asChild variant="link" size="auto" className="mt-0.5 h-auto p-0 text-xs">
                <Link to={`/terminals?search=${encodeURIComponent(host)}`}>
                    {t('systemHealth.details.open')}
                    <ExternalLink aria-hidden="true" className="size-3" />
                </Link>
            </Button>
        </span>
    );
}

interface TerminalsData {
    items: { id: number; name: string; host: string; school: string; district: string; lastSeenAt: string | null; minutes: number | null; error: string | null }[];
}
interface PhotosData {
    terminals: { id: number; name: string; host: string; school: string; pending: number; failed: number; maxAttempts: number }[];
    reasons: { reason: string; total: number }[];
}
interface QueuesData {
    items: { queue: string; id: string; name: string; reason: string; attempts: number; finishedAt: string | null }[];
}
interface DiskData {
    totalBytes: number;
    freeBytes: number;
    folders: { path: string; bytes: number }[];
    partial: boolean;
}
interface PushData {
    items: { id: number; name: string; host: string; school: string; pushEnabled: boolean; lastReceivedAt: string | null; lastEventAt: string | null; minutes: number | null }[];
}
interface StatsData {
    items: { id: number; name: string; district: string; computedAt: string; minutes: number | null }[];
}

function Empty({ keyName }: { keyName: DetailKey }) {
    const { t } = useTranslation();
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t(`systemHealth.details.empty.${keyName}`)}</p>;
}

function TableBox({ children }: { children: React.ReactNode }) {
    return <div className="max-h-96 overflow-auto rounded-xl border">{children}</div>;
}

function Body({ checkKey }: { checkKey: DetailKey }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<unknown>(`/system/health/${checkKey}/details`);

    if (loading) return <LoadingState rows={4} />;
    if (error || !data) return <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />;
    const c = (key: string) => t(`systemHealth.details.cols.${key}`);

    if (checkKey === 'terminals') {
        const { items } = data as TerminalsData;
        if (items.length === 0) return <Empty keyName="terminals" />;
        return (
            <TableBox>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">{c('terminal')}</TableHead>
                            <TableHead>{c('school')}</TableHead>
                            <TableHead>{c('lastSeen')}</TableHead>
                            <TableHead className="pr-4">{c('error')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="pl-4 whitespace-normal"><TerminalLink id={row.id} name={row.name} host={row.host} /></TableCell>
                                <TableCell className="whitespace-normal">{row.school}<span className="block text-xs text-muted-foreground">{row.district}</span></TableCell>
                                <TableCell className="tabular-nums">
                                    <StatusBadge tone="danger" dot={false}>{ago(row.minutes, t)}</StatusBadge>
                                    {row.lastSeenAt && <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(row.lastSeenAt)}</span>}
                                </TableCell>
                                <TableCell className="pr-4 text-xs whitespace-normal [overflow-wrap:anywhere]">{row.error ?? '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableBox>
        );
    }

    if (checkKey === 'photos') {
        const d = data as PhotosData;
        if (d.terminals.length === 0) return <Empty keyName="photos" />;
        return (
            <div className="space-y-5">
                <section className="space-y-2">
                    <h3 className="text-sm font-semibold">{t('systemHealth.details.sections.byTerminal')}</h3>
                    <TableBox>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{c('terminal')}</TableHead>
                                    <TableHead>{c('school')}</TableHead>
                                    <TableHead>{c('pending')}</TableHead>
                                    <TableHead>{c('failed')}</TableHead>
                                    <TableHead className="pr-4">{c('attempts')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {d.terminals.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="pl-4 whitespace-normal"><TerminalLink id={row.id} name={row.name} host={row.host} /></TableCell>
                                        <TableCell className="whitespace-normal">{row.school}</TableCell>
                                        <TableCell className="font-semibold tabular-nums">{formatNumber(row.pending)}</TableCell>
                                        <TableCell className="font-semibold text-destructive tabular-nums">{formatNumber(row.failed)}</TableCell>
                                        <TableCell className="pr-4 tabular-nums">{row.maxAttempts}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableBox>
                </section>
                <section className="space-y-2">
                    <h3 className="text-sm font-semibold">{t('systemHealth.details.sections.reasons')}</h3>
                    <TableBox>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{c('reason')}</TableHead>
                                    <TableHead className="pr-4">{c('count')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {d.reasons.map((row) => (
                                    <TableRow key={row.reason}>
                                        <TableCell className="pl-4 text-xs whitespace-normal [overflow-wrap:anywhere]">{row.reason}</TableCell>
                                        <TableCell className="pr-4 font-semibold tabular-nums">{formatNumber(row.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableBox>
                </section>
            </div>
        );
    }

    if (checkKey === 'queues') {
        const { items } = data as QueuesData;
        if (items.length === 0) return <Empty keyName="queues" />;
        return (
            <TableBox>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">{c('queue')}</TableHead>
                            <TableHead>{c('job')}</TableHead>
                            <TableHead>{c('reason')}</TableHead>
                            <TableHead>{c('attempts')}</TableHead>
                            <TableHead className="pr-4">{c('finished')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((row) => (
                            <TableRow key={`${row.queue}-${row.id}`}>
                                <TableCell className="pl-4 whitespace-normal">{t(`systemHealth.details.queues.${row.queue}`, { defaultValue: row.queue })}</TableCell>
                                <TableCell className="font-mono text-xs whitespace-normal [overflow-wrap:anywhere]">{row.name} #{row.id}</TableCell>
                                <TableCell className="text-xs whitespace-normal [overflow-wrap:anywhere]">{row.reason || '—'}</TableCell>
                                <TableCell className="tabular-nums">{row.attempts}</TableCell>
                                <TableCell className="pr-4 tabular-nums">{row.finishedAt ? formatDateTime(row.finishedAt) : '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableBox>
        );
    }

    if (checkKey === 'disk') {
        const d = data as DiskData;
        const used = d.totalBytes > 0 ? Math.round((100 * (d.totalBytes - d.freeBytes)) / d.totalBytes) : 0;
        const max = Math.max(1, ...d.folders.map((folder) => folder.bytes));
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <p className="text-sm font-medium">{t('systemHealth.details.disk.free', { free: bytes(d.freeBytes, t), total: bytes(d.totalBytes, t) })}</p>
                    <Progress value={used} aria-label={t('systemHealth.checks.disk.name')} />
                </div>
                <TableBox>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-4">{c('folder')}</TableHead>
                                <TableHead className="pr-4">{c('size')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {d.folders.map((row) => (
                                <TableRow key={row.path}>
                                    <TableCell className="pl-4 font-mono text-xs">{row.path}</TableCell>
                                    <TableCell className="pr-4">
                                        <span className="font-semibold tabular-nums">{bytes(row.bytes, t)}</span>
                                        <Progress value={Math.round((100 * row.bytes) / max)} className="mt-1 h-1.5" aria-hidden="true" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableBox>
                {d.partial && <p className="text-xs text-muted-foreground">{t('systemHealth.details.disk.partial')}</p>}
            </div>
        );
    }

    if (checkKey === 'push') {
        const { items } = data as PushData;
        if (items.length === 0) return <Empty keyName="push" />;
        return (
            <TableBox>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">{c('terminal')}</TableHead>
                            <TableHead>{c('school')}</TableHead>
                            <TableHead>{c('pushOn')}</TableHead>
                            <TableHead>{c('lastRequest')}</TableHead>
                            <TableHead className="pr-4">{c('lastEvent')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="pl-4 whitespace-normal"><TerminalLink id={row.id} name={row.name} host={row.host} /></TableCell>
                                <TableCell className="whitespace-normal">{row.school}</TableCell>
                                <TableCell>{row.pushEnabled ? t('systemHealth.details.yes') : <StatusBadge tone="warning" dot={false}>{t('systemHealth.details.no')}</StatusBadge>}</TableCell>
                                <TableCell className="tabular-nums">{ago(row.minutes, t)}</TableCell>
                                <TableCell className="pr-4 tabular-nums">{row.lastEventAt ? formatDateTime(row.lastEventAt) : '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableBox>
        );
    }

    const { items } = data as StatsData;
    if (items.length === 0) return <Empty keyName="stats" />;
    return (
        <TableBox>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="pl-4">{c('school')}</TableHead>
                        <TableHead className="pr-4">{c('computed')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className="pl-4 whitespace-normal">{row.name}<span className="block text-xs text-muted-foreground">{row.district}</span></TableCell>
                            <TableCell className="pr-4 tabular-nums">{ago(row.minutes, t)}<span className="block text-xs text-muted-foreground">{formatDateTime(row.computedAt)}</span></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableBox>
    );
}

/** «Batafsil»: tekshiruv ortidagi aniq ro‘yxat (faqat ko‘rish). */
export function HealthDetailsDialog({ checkKey, onClose }: { checkKey: DetailKey | null; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Dialog open={checkKey !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
                {checkKey && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t(`systemHealth.checks.${checkKey}.name`)}</DialogTitle>
                            <DialogDescription>{t(`systemHealth.details.desc.${checkKey}`)}</DialogDescription>
                        </DialogHeader>
                        <Body key={checkKey} checkKey={checkKey} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
