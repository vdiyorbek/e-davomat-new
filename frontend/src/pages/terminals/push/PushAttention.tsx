import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatDateTime, formatNumber } from '@/lib/date';

import { humanLag } from './push-shared';
import type { AttentionTerminal, Summary, TerminalStatus } from './push-shared';

type Tab = 'LAGGING' | 'NEVER' | 'IDLE' | 'ABORTED';

const TABS: Tab[] = ['LAGGING', 'NEVER', 'IDLE', 'ABORTED'];
const TONES: Record<TerminalStatus, StatusTone> = { REALTIME: 'success', LAGGING: 'warning', IDLE: 'neutral', NEVER: 'danger' };

function TerminalName({ name, id, school }: { name: string; id: number; school: string | null }) {
    return (
        <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">
                #{id}
                {school ? ` · ${school}` : ''}
            </span>
        </span>
    );
}

/** E’tibor talab qiladigan terminallar: bitta kartada, turlar bo‘yicha yorliqlar. */
export function PushAttention({ summary }: { summary: Summary | null }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('LAGGING');

    const byStatus = (status: TerminalStatus): AttentionTerminal[] =>
        (summary?.attention ?? []).filter((row) => row.status === status);
    const counts: Record<Tab, number> = {
        LAGGING: summary?.terminals.lagging ?? 0,
        NEVER: summary?.terminals.never ?? 0,
        IDLE: summary?.terminals.idle ?? 0,
        ABORTED: summary?.aborted.terminals ?? 0,
    };

    function renderRows() {
        if (!summary) return null;
        if (tab === 'ABORTED') {
            if (summary.aborted.top.length === 0) return null;
            return summary.aborted.top.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <TerminalName name={row.name} id={row.id} school={row.schoolName} />
                    <StatusBadge tone={row.count >= 50 ? 'danger' : 'warning'}>
                        {t('syncHistory.push.aborted.count', { count: row.count })}
                    </StatusBadge>
                </li>
            ));
        }
        const rows = byStatus(tab);
        if (rows.length === 0) return null;
        return rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <TerminalName name={row.name} id={row.id} school={row.schoolName} />
                <span className="flex flex-col items-end text-right text-xs text-muted-foreground">
                    {tab === 'LAGGING' && row.lagMinutes !== null && (
                        <>
                            <StatusBadge tone={TONES.LAGGING}>{humanLag(row.lagMinutes * 60, t)}</StatusBadge>
                            {row.lastEventAt && (
                                <span className="mt-1">{t('syncHistory.push.attention.sending', { date: formatDate(row.lastEventAt) })}</span>
                            )}
                        </>
                    )}
                    {tab === 'NEVER' && (
                        <>
                            <StatusBadge tone={TONES.NEVER}>{t('syncHistory.push.status.NEVER')}</StatusBadge>
                            <span className="mt-1 max-w-56">{t('syncHistory.push.attention.neverHint')}</span>
                        </>
                    )}
                    {tab === 'IDLE' && (
                        <>
                            <StatusBadge tone={TONES.IDLE}>{t('syncHistory.push.status.IDLE')}</StatusBadge>
                            <span className="mt-1">{t('syncHistory.push.attention.lastRequest', { value: formatDateTime(row.lastReceivedAt) })}</span>
                        </>
                    )}
                </span>
            </li>
        ));
    }

    const rows = renderRows();

    return (
        <Card className="min-w-0 gap-0 py-0">
            <div className="space-y-3 border-b p-4">
                <div>
                    <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                        <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
                        {t('syncHistory.push.attention.title')}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(`syncHistory.push.attention.hints.${tab}`)}</p>
                </div>
                <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                    <TabsList aria-label={t('syncHistory.push.attention.title')} className="grid h-auto w-full grid-cols-4">
                        {TABS.map((value) => (
                            <TabsTrigger key={value} value={value} className="min-w-0 flex-col gap-0.5 px-1.5 py-1.5 text-xs">
                                <span className="max-w-full truncate">{t(`syncHistory.push.attention.tabs.${value}`)}</span>
                                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                                    {formatNumber(counts[value])}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>
            {rows ? (
                <ul className="max-h-[26rem] list-none divide-y overflow-y-auto">{rows}</ul>
            ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                    <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
                    {t('syncHistory.push.attention.empty')}
                </div>
            )}
        </Card>
    );
}
