import { useState } from 'react';
import { Download, Loader2, ScanSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authorizedPost } from '@/lib/auth-session';

interface AuditItem {
    id: number;
    name: string;
    host: string;
    eventSource: string;
    model: string | null;
    firmware: string | null;
    firmwareDate: string | null;
    pictureUrlType: string | null;
    pushTarget: string | null;
    heartbeat: string | null;
    eventMode: string | null;
    uploadCapPic: boolean | null;
    saveCapPic: boolean | null;
    uploadVerificationPic: boolean | null;
    saveVerificationPic: boolean | null;
    saveFacePic: boolean | null;
    todayTotal: number;
    todayInline: number;
    inlinePercent: number | null;
    error: string | null;
}

interface AuditResult {
    generatedAt: string;
    items: AuditItem[];
    groups: { key: string; terminals: number; events: number; inlinePercent: number | null }[];
}

function csvCell(value: unknown) {
    const text = value === null || value === undefined ? '' : String(value);
    // Formula ishga tushmasin.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}

function Flag({ value }: { value: boolean | null }) {
    if (value === null) return <span className="text-muted-foreground">—</span>;
    return <StatusBadge tone={value ? 'success' : 'danger'}>{value ? '✓' : '✗'}</StatusBadge>;
}

/** Barcha terminallarning model, firmware va rasm sozlamalarini bitta jadvalda solishtiradi (faqat o‘qiydi). */
export function TerminalConfigAudit() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<AuditResult | null>(null);

    async function run() {
        setOpen(true);
        setBusy(true);
        setError('');
        setResult(null);
        try {
            setResult(await authorizedPost<AuditResult>('/terminals/bulk/config-audit', {}, 5 * 60_000));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.audit.failed'));
        } finally {
            setBusy(false);
        }
    }

    function download() {
        if (!result) return;
        const head = [
            'id',
            'name',
            'host',
            'model',
            'firmware',
            'firmwareDate',
            'pictureURLType',
            'pushTarget',
            'heartbeat',
            'eventMode',
            'uploadCapPic',
            'saveCapPic',
            'uploadVerificationPic',
            'saveVerificationPic',
            'saveFacePic',
            'todayDownloaded',
            'todayWithPush',
            'pushPicturePercent',
            'error',
        ];
        const rows = result.items.map((i) =>
            [
                i.id,
                i.name,
                i.host,
                i.model,
                i.firmware,
                i.firmwareDate,
                i.pictureUrlType,
                i.pushTarget,
                i.heartbeat,
                i.eventMode,
                i.uploadCapPic,
                i.saveCapPic,
                i.uploadVerificationPic,
                i.saveVerificationPic,
                i.saveFacePic,
                i.todayTotal,
                i.todayInline,
                i.inlinePercent,
                i.error,
            ]
                .map(csvCell)
                .join(','),
        );
        const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'terminal-sozlamalari.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ScanSearch aria-hidden="true" />}
                {t('terminals.audit.button')}
            </Button>
            <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
                <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>{t('terminals.audit.title')}</DialogTitle>
                        <DialogDescription>{t('terminals.audit.description')}</DialogDescription>
                    </DialogHeader>
                    {busy && (
                        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                            {t('terminals.audit.running')}
                        </div>
                    )}
                    {error && <ErrorState message={error} />}
                    {result && (
                        <div className="space-y-5">
                            <section className="space-y-2">
                                <h3 className="text-sm font-semibold">{t('terminals.audit.groups')}</h3>
                                <p className="text-xs text-muted-foreground">{t('terminals.audit.groupsHint')}</p>
                                <div className="overflow-x-auto rounded-xl border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-4">{t('terminals.audit.modelFirmware')}</TableHead>
                                                <TableHead>{t('terminals.audit.terminals')}</TableHead>
                                                <TableHead>{t('terminals.audit.events')}</TableHead>
                                                <TableHead className="pr-4">{t('terminals.audit.pushPicture')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.groups.map((group) => (
                                                <TableRow key={group.key}>
                                                    <TableCell className="pl-4 font-medium">{group.key}</TableCell>
                                                    <TableCell className="tabular-nums">{group.terminals}</TableCell>
                                                    <TableCell className="tabular-nums">{group.events}</TableCell>
                                                    <TableCell className="pr-4">
                                                        {group.inlinePercent === null ? (
                                                            '—'
                                                        ) : (
                                                            <StatusBadge
                                                                tone={
                                                                    group.inlinePercent >= 80
                                                                        ? 'success'
                                                                        : group.inlinePercent >= 20
                                                                          ? 'warning'
                                                                          : 'danger'
                                                                }
                                                            >
                                                                {group.inlinePercent}%
                                                            </StatusBadge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>

                            <section className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold">{t('terminals.audit.details')}</h3>
                                    <Button type="button" variant="outline" size="sm" onClick={download}>
                                        <Download aria-hidden="true" />
                                        CSV
                                    </Button>
                                </div>
                                <div className="overflow-x-auto rounded-xl border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-4">{t('terminals.audit.terminal')}</TableHead>
                                                <TableHead>{t('terminals.audit.modelFirmware')}</TableHead>
                                                <TableHead>{t('terminals.audit.pictureType')}</TableHead>
                                                <TableHead title="uploadCapPic">Cap↑</TableHead>
                                                <TableHead title="saveCapPic">Cap💾</TableHead>
                                                <TableHead title="uploadVerificationPic">Ver↑</TableHead>
                                                <TableHead title="saveVerificationPic">Ver💾</TableHead>
                                                <TableHead title="saveFacePic">Face💾</TableHead>
                                                <TableHead>{t('terminals.audit.pushTarget')}</TableHead>
                                                <TableHead className="pr-4">{t('terminals.audit.pushPicture')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="pl-4">
                                                        <span className="font-medium">{item.name}</span>
                                                        <span className="block text-xs text-muted-foreground">#{item.id}</span>
                                                    </TableCell>
                                                    {item.error && !item.model ? (
                                                        <TableCell colSpan={9} className="text-sm text-destructive">
                                                            {item.error}
                                                        </TableCell>
                                                    ) : (
                                                        <>
                                                            <TableCell>
                                                                {item.model ?? '—'}
                                                                <span className="block text-xs text-muted-foreground">
                                                                    {item.firmware ?? '—'} {item.firmwareDate ? `(${item.firmwareDate})` : ''}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>{item.pictureUrlType ?? '—'}</TableCell>
                                                            <TableCell><Flag value={item.uploadCapPic} /></TableCell>
                                                            <TableCell><Flag value={item.saveCapPic} /></TableCell>
                                                            <TableCell><Flag value={item.uploadVerificationPic} /></TableCell>
                                                            <TableCell><Flag value={item.saveVerificationPic} /></TableCell>
                                                            <TableCell><Flag value={item.saveFacePic} /></TableCell>
                                                            <TableCell className="text-xs">{item.pushTarget ?? '—'}</TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="pr-4 tabular-nums">
                                                        {item.inlinePercent === null ? '—' : `${item.inlinePercent}% (${item.todayInline}/${item.todayTotal})`}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
