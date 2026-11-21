import { useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, DownloadCloud, HelpCircle, PauseCircle, RadioTower } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { KpiCard } from '@/components/common/KpiCard';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { formatNumber, todayInTashkent } from '@/lib/date';
import { cn } from '@/lib/utils';

import { PushAttention } from './push/PushAttention';
import { PushDayChart } from './push/PushDayChart';
import { PushDayTerminals } from './push/PushDayTerminals';
import { PushJournal } from './push/PushJournal';
import type { DayResponse, Summary } from './push/push-shared';

const HELP_KEYS = ['received', 'inserted', 'duplicates', 'lag', 'pull'] as const;

/** «Push va olish» yorlig‘i: holat → bugungi faoliyat → terminallar bo‘yicha → batafsil jurnal. */
export function PushActivitySection() {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const [date, setDate] = useState(today);
    const [journalOpen, setJournalOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const summary = useApiQuery<Summary>('/terminal-event-activity/summary');
    const day = useApiQuery<DayResponse>(`/terminal-event-activity/day?date=${date}`);
    useInterval(() => {
        summary.retry();
        if (date === today) day.retry();
    }, 15_000);

    const push = summary.data?.today.find((item) => item.source === 'PUSH');

    return (
        <section className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-3xl text-sm text-muted-foreground">{t('syncHistory.push.description')}</p>
                <Button type="button" variant="ghost" size="sm" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>
                    <HelpCircle aria-hidden="true" />
                    {t('syncHistory.push.help.button')}
                </Button>
            </div>

            {helpOpen && (
                <dl className="grid gap-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    {HELP_KEYS.map((key) => (
                        <div key={key}>
                            <dt className="font-semibold">{t(`syncHistory.push.help.items.${key}.term`)}</dt>
                            <dd className="mt-0.5 text-muted-foreground">{t(`syncHistory.push.help.items.${key}.text`)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <KpiCard label={t('syncHistory.push.kpi.total')} value={summary.data?.terminals.total ?? 0} icon={RadioTower} loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.realtime')} value={summary.data?.terminals.realtime ?? 0} icon={Activity} tone="success" loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.lagging')} value={summary.data?.terminals.lagging ?? 0} icon={AlertTriangle} tone="warning" hint={t('syncHistory.push.kpi.laggingHint')} loading={summary.loading} />
                <KpiCard label={t('syncHistory.push.kpi.idle')} value={summary.data?.terminals.idle ?? 0} icon={PauseCircle} tone="danger" hint={t('syncHistory.push.kpi.idleHint')} loading={summary.loading} />
                <KpiCard
                    label={t('syncHistory.push.kpi.today')}
                    value={formatNumber(push?.received ?? 0)}
                    hint={t('syncHistory.push.kpi.todayNew', { count: formatNumber(push?.inserted ?? 0) })}
                    icon={DownloadCloud}
                    loading={summary.loading}
                />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <PushAttention summary={summary.data} />
                <PushDayChart date={date} onDateChange={setDate} data={day.data} loading={day.loading} error={day.error} onRetry={day.retry} />
            </div>

            <PushDayTerminals data={day.data} date={date} />

            <div className="space-y-3">
                <Button type="button" variant="outline" aria-expanded={journalOpen} onClick={() => setJournalOpen((open) => !open)}>
                    <ChevronDown aria-hidden="true" className={cn('transition-transform', journalOpen && 'rotate-180')} />
                    {journalOpen ? t('syncHistory.push.journal.hide') : t('syncHistory.push.journal.show')}
                </Button>
                {journalOpen && <PushJournal />}
            </div>
        </section>
    );
}
