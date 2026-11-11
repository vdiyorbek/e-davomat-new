import { useEffect, useId, useRef, useState } from 'react';
import { Eraser, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authorizedGet, authorizedPost } from '@/lib/auth-session';
import {
    clearErrorKey,
    sleep,
    type ClearJobResponse,
    type ClearResult,
} from '@/lib/terminal-clear';
import { cn } from '@/lib/utils';

type QueueStatus = 'QUEUED' | 'NOT_FOUND' | 'INACTIVE' | 'SYNC_IN_PROGRESS';

interface QueueItem {
    terminalId: number;
    status: QueueStatus;
    jobId?: string;
    count?: number;
}

type RowPhase = 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'skipped';

interface Row {
    terminalId: number;
    phase: RowPhase;
    result?: ClearResult;
    message?: string;
}

const POLL_MS = 3000;
const MAX_WAIT_MS = 15 * 60_000;

function RowStatus({ row }: { row: Row }) {
    const { t } = useTranslation();

    if (row.phase === 'queued') {
        return <StatusBadge tone="neutral">{t('terminals.bulk.clear.queued')}</StatusBadge>;
    }

    if (row.phase === 'running') {
        return (
            <StatusBadge tone="info">
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                {t('terminals.bulk.clear.active')}
            </StatusBadge>
        );
    }

    if (row.phase === 'done' && row.result) {
        return (
            <StatusBadge tone="success">
                {t('terminals.bulk.clear.done', {
                    before: row.result.usersBefore,
                    after: row.result.usersAfter,
                })}
            </StatusBadge>
        );
    }

    if (row.phase === 'partial' && row.result) {
        return (
            <StatusBadge tone="warning">
                {t('terminals.bulk.clear.partial', { count: row.result.usersAfter })}
            </StatusBadge>
        );
    }

    return (
        <span
            className={cn(
                'text-xs',
                row.phase === 'failed' ? 'text-destructive' : 'text-muted-foreground',
            )}
        >
            {row.message}
        </span>
    );
}

/** Tanlangan terminallar xotirasini ommaviy tozalash. */
export function BulkTerminalClear({
    terminalIds,
    onFinished,
}: {
    terminalIds: number[];
    onFinished: () => void;
}) {
    const { t } = useTranslation();
    const inputId = useId();
    const [typed, setTyped] = useState('');
    const [running, setRunning] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    // Oyna yopilsa kuzatishni to‘xtatamiz (backend ishini davom ettiradi).
    useEffect(() => () => abortRef.current?.abort(), []);

    const word = t('terminals.bulk.clear.confirmWord');
    const canSubmit =
        !running &&
        terminalIds.length > 0 &&
        typed.trim().toUpperCase() === word.toUpperCase();

    function updateRow(terminalId: number, patch: Partial<Row>) {
        setRows((current) =>
            current.map((row) =>
                row.terminalId === terminalId ? { ...row, ...patch } : row,
            ),
        );
    }

    function errorText(raw: string | null | undefined) {
        const key = clearErrorKey(raw);
        return key ? t(key) : raw || t('terminals.clearPersons.errors.generic');
    }

    async function handleSubmit() {
        if (!canSubmit) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setRunning(true);
        setError('');
        setRows([]);

        try {
            const { results } = await authorizedPost<{ results: QueueItem[] }>(
                '/person-sync-queue/terminals/bulk-clear',
                { terminalIds, confirm: 'CLEAR_SELECTED_TERMINALS' },
            );

            setTyped('');
            setRows(
                results.map((item): Row =>
                    item.status === 'QUEUED'
                        ? { terminalId: item.terminalId, phase: 'queued' }
                        : {
                            terminalId: item.terminalId,
                            phase: 'skipped',
                            message: t(`terminals.bulk.clear.skip.${item.status}`, {
                                count: item.count ?? 0,
                            }),
                        },
                ),
            );

            const pending = new Map<string, number>();
            for (const item of results) {
                if (item.status === 'QUEUED' && item.jobId) {
                    pending.set(item.jobId, item.terminalId);
                }
            }

            const startedAt = Date.now();

            while (pending.size > 0 && Date.now() - startedAt < MAX_WAIT_MS) {
                await sleep(POLL_MS, controller.signal);

                for (const [jobId, terminalId] of [...pending]) {
                    let job: ClearJobResponse;

                    try {
                        job = await authorizedGet<ClearJobResponse>(
                            `/person-sync-queue/jobs/${encodeURIComponent(jobId)}`,
                            controller.signal,
                        );
                    } catch (caught: unknown) {
                        if (controller.signal.aborted) throw caught;
                        continue; // Vaqtinchalik tarmoq xatosi — keyingi aylanishda qayta so‘raymiz.
                    }

                    if (job.state === 'completed' && job.result) {
                        updateRow(terminalId, {
                            phase: job.result.cleared ? 'done' : 'partial',
                            result: job.result,
                        });
                        pending.delete(jobId);
                    } else if (job.state === 'failed') {
                        updateRow(terminalId, { phase: 'failed', message: errorText(job.error) });
                        pending.delete(jobId);
                    } else if (job.state === 'active') {
                        updateRow(terminalId, { phase: 'running' });
                    }
                }
            }

            for (const terminalId of pending.values()) {
                updateRow(terminalId, {
                    phase: 'failed',
                    message: t('terminals.clearPersons.errors.watchTimeout'),
                });
            }

            onFinished();
        } catch (caught: unknown) {
            if (controller.signal.aborted) return;
            setError(
                caught instanceof Error
                    ? errorText(caught.message)
                    : t('terminals.clearPersons.errors.generic'),
            );
        } finally {
            if (!controller.signal.aborted) setRunning(false);
        }
    }

    return (
        <section className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div>
                <h3 className="text-sm font-semibold text-destructive">
                    {t('terminals.bulk.clear.title', { count: terminalIds.length })}
                </h3>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                    <li>{t('terminals.clearPersons.warnAll')}</li>
                    <li>{t('terminals.clearPersons.warnEvents')}</li>
                    <li>{t('terminals.clearPersons.warnResync')}</li>
                </ul>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={inputId}>
                    {t('terminals.bulk.clear.confirmLabel', { word })}
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id={inputId}
                        value={typed}
                        autoComplete="off"
                        disabled={running}
                        placeholder={word}
                        onChange={(event) => setTyped(event.target.value)}
                        className="sm:max-w-56"
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={!canSubmit}
                        onClick={() => void handleSubmit()}
                    >
                        {running ? (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                        ) : (
                            <Eraser aria-hidden="true" />
                        )}
                        {running
                            ? t('terminals.bulk.clear.running')
                            : t('terminals.bulk.clear.submit', { count: terminalIds.length })}
                    </Button>
                </div>
            </div>

            {rows.length > 0 && (
                <ul className="divide-y rounded-xl border bg-background">
                    {rows.map((row) => (
                        <li
                            key={row.terminalId}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                        >
                            <span className="font-medium">
                                {t('terminals.bulk.terminal', { id: row.terminalId })}
                            </span>
                            <RowStatus row={row} />
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </section>
    );
}