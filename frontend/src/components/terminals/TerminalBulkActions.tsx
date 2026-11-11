import { useId, useState } from 'react';
import { CalendarClock, HardDrive, Power, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SuccessNotice } from '@/components/common/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authorizedPost } from '@/lib/auth-session';
import { formatDate, todayInTashkent } from '@/lib/date';
import { BulkTerminalClear } from './BulkTerminalClear';
import { BulkPersonSyncPanel } from './BulkPersonSyncPanel';

interface PreviewResult {
    terminalId: number;
    status: string;
    personsCount: number | null;
}

interface ClearPreviewResponse {
    success: boolean;
    dryRun: boolean;
    willDelete: boolean;
    results: PreviewResult[];
}

interface Props {
    terminalIds: number[];
    onSubmitted: () => void;
}

const MAX_BULK = 100;
const MAX_MEMORY = 5;

function LimitHint({ max }: { max: number }) {
    const { t } = useTranslation();
    return (
        <Alert variant="destructive">
            <AlertDescription>{t('terminals.bulk.limitHint', { max })}</AlertDescription>
        </Alert>
    );
}

/** Tanlangan terminallar ustida ommaviy amallar (dialog ichida ko‘rsatiladi). */
export function TerminalBulkActions({ terminalIds, onSubmitted }: Props) {
    const { t } = useTranslation();
    const dateId = useId();
    const { confirm, dialog } = useConfirm();
    const count = terminalIds.length;

    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // Xotira tekshiruvi
    const [memoryBusy, setMemoryBusy] = useState(false);
    const [preview, setPreview] = useState<ClearPreviewResponse | null>(null);
    const [previewKey, setPreviewKey] = useState('');
    const selectionKey = [...terminalIds].sort((a, b) => a - b).join(',');
    const clearableIds =
        preview && previewKey === selectionKey
            ? preview.results
                .filter((item) => item.status === 'READY' && (item.personsCount ?? 0) > 0)
                .map((item) => item.terminalId)
            : [];
    // Sinxronlash vaqti
    const [syncStartDate, setSyncStartDate] = useState(todayInTashkent);
    const [savingSyncTime, setSavingSyncTime] = useState(false);

    // Faollashtirish
    const [activating, setActivating] = useState(false);

    function resetMessages() {
        setError('');
        setNotice('');
    }

    async function saveBulkSyncTime() {
        if (savingSyncTime || count === 0 || count > MAX_BULK) return;
        resetMessages();

        if (!/^20\d{2}-\d{2}-\d{2}$/.test(syncStartDate)) {
            setError(t('terminals.bulk.syncTime.invalidDate'));
            return;
        }

        const startTime = `${syncStartDate}T00:00:00+05:00`;
        const timestamp = Date.parse(startTime);
        if (
            !Number.isFinite(timestamp) ||
            timestamp > Date.now() ||
            new Date(timestamp + 5 * 3600_000).toISOString().slice(0, 10) !== syncStartDate
        ) {
            setError(t('terminals.bulk.syncTime.futureDate'));
            return;
        }

        const confirmed = await confirm({
            title: t('terminals.bulk.syncTime.confirmTitle'),
            description: t('terminals.bulk.syncTime.confirmText', { count, date: formatDate(syncStartDate) }),
        });
        if (!confirmed) return;

        setSavingSyncTime(true);
        try {
            const result = await authorizedPost<{ success: boolean; updated: number; syncStartAt: string }>(
                '/terminals/bulk/sync-start',
                { terminalIds, startTime, confirm: 'SET_BULK_SYNC_START' },
            );
            setNotice(t('terminals.bulk.syncTime.done', { count: result.updated }));
            onSubmitted();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.bulk.syncTime.failed'));
        } finally {
            setSavingSyncTime(false);
        }
    }

    async function activateSelected() {
        if (activating || count === 0 || count > MAX_BULK) return;
        resetMessages();

        const confirmed = await confirm({
            title: t('terminals.bulk.activate.confirmTitle'),
            description: t('terminals.bulk.activate.confirmText', { count }),
        });
        if (!confirmed) return;

        setActivating(true);
        try {
            const result = await authorizedPost<{
                success: boolean;
                selected: number;
                activated: number;
                alreadyActive: number;
            }>('/terminals/bulk/activate', { terminalIds, confirm: 'ACTIVATE_SELECTED_TERMINALS' });
            setNotice(
                t('terminals.bulk.activate.done', { activated: result.activated, already: result.alreadyActive }),
            );
            onSubmitted();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.bulk.activate.failed'));
        } finally {
            setActivating(false);
        }
    }

    async function checkMemory() {
        if (memoryBusy || count === 0 || count > MAX_MEMORY) return;
        resetMessages();
        setMemoryBusy(true);
        setPreview(null);
        try {
            const data = await authorizedPost<ClearPreviewResponse>('/terminals/bulk/clear-preview', { terminalIds });
            setPreview(data);
            setPreviewKey(selectionKey);
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('terminals.bulk.memory.failed'));
        } finally {
            setMemoryBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            {dialog}

            <Tabs defaultValue="persons" onValueChange={resetMessages}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:h-11">
                    <TabsTrigger value="persons" className="py-2">
                        <Users aria-hidden="true" />
                        {t('terminals.bulk.tabs.persons')}
                    </TabsTrigger>
                    <TabsTrigger value="sync-time" className="py-2">
                        <CalendarClock aria-hidden="true" />
                        {t('terminals.bulk.tabs.syncTime')}
                    </TabsTrigger>
                    <TabsTrigger value="memory" className="py-2">
                        <HardDrive aria-hidden="true" />
                        {t('terminals.bulk.tabs.memory')}
                    </TabsTrigger>
                    <TabsTrigger value="activate" className="py-2">
                        <Power aria-hidden="true" />
                        {t('terminals.bulk.tabs.activate')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="persons" className="pt-1">
                    <BulkPersonSyncPanel terminalIds={terminalIds} onSubmitted={onSubmitted} />
                </TabsContent>

                <TabsContent value="sync-time" className="space-y-4 pt-1">
                    <Field
                        htmlFor={dateId}
                        label={t('terminals.bulk.syncTime.label')}
                        hint={t('terminals.bulk.syncTime.hint')}
                    >
                        <Input
                            id={dateId}
                            type="date"
                            min="2000-01-01"
                            max={todayInTashkent()}
                            value={syncStartDate}
                            onChange={(event) => setSyncStartDate(event.target.value)}
                            className="sm:max-w-56"
                        />
                    </Field>
                    {count > MAX_BULK && <LimitHint max={MAX_BULK} />}
                    <Button
                        type="button"
                        disabled={savingSyncTime || count === 0 || count > MAX_BULK}
                        onClick={() => void saveBulkSyncTime()}
                    >
                        <CalendarClock aria-hidden="true" />
                        {savingSyncTime ? t('common.saving') : t('terminals.bulk.syncTime.submit')}
                    </Button>
                </TabsContent>

                <TabsContent value="memory" className="space-y-4 pt-1">
                    {clearableIds.length > 0 && (
                        <BulkTerminalClear
                            key={selectionKey}
                            terminalIds={clearableIds}
                            onFinished={onSubmitted}
                        />
                    )}
                    {count > MAX_MEMORY && <LimitHint max={MAX_MEMORY} />}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={memoryBusy || count === 0 || count > MAX_MEMORY}
                        onClick={() => void checkMemory()}
                    >
                        <HardDrive aria-hidden="true" />
                        {memoryBusy ? t('terminals.bulk.memory.checking') : t('terminals.bulk.memory.submit')}
                    </Button>

                    {preview && previewKey === selectionKey && (
                        <ul className="divide-y rounded-xl border">
                            {preview.results.map((item) => (
                                <li key={item.terminalId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                                    <span className="font-medium">{t('terminals.bulk.terminal', { id: item.terminalId })}</span>
                                    {item.status === 'READY' ? (
                                        <span className="font-semibold tabular-nums">
                                            {t('terminals.bulk.memory.persons', { count: item.personsCount ?? 0 })}
                                        </span>
                                    ) : item.status === 'INACTIVE' ? (
                                        <StatusBadge tone="warning">{t('terminals.bulk.memory.inactive')}</StatusBadge>
                                    ) : (
                                        <StatusBadge tone="danger">{t('terminals.bulk.memory.error')}</StatusBadge>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">{t('terminals.bulk.memory.noDelete')}</p>
                </TabsContent>

                <TabsContent value="activate" className="space-y-4 pt-1">
                    <p className="text-sm text-muted-foreground">{t('terminals.bulk.activate.hint')}</p>
                    {count > MAX_BULK && <LimitHint max={MAX_BULK} />}
                    <Button
                        type="button"
                        disabled={activating || count === 0 || count > MAX_BULK}
                        onClick={() => void activateSelected()}
                    >
                        <Power aria-hidden="true" />
                        {activating ? t('terminals.bulk.activate.busy') : t('terminals.bulk.activate.submit')}
                    </Button>
                </TabsContent>
            </Tabs>

            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
