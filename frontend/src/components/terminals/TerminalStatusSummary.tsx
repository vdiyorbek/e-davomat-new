import { CircleAlert, CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { Terminal } from '@/types/terminal';

import { isArchived } from './terminal-status';
import type { SyncInfo } from './terminal-status';

type Level = 'ok' | 'warn' | 'crit' | 'neutral';

const STYLE: Record<Level, { box: string; icon: string; Icon: LucideIcon }> = {
    ok: { box: 'border-success/40 bg-success/8', icon: 'text-success', Icon: CircleCheck },
    warn: { box: 'border-warning/50 bg-warning/10', icon: 'text-warning', Icon: CircleAlert },
    crit: { box: 'border-destructive/40 bg-destructive/8', icon: 'text-destructive', Icon: CircleX },
    neutral: { box: 'border-border bg-muted/30', icon: 'text-muted-foreground', Icon: CircleHelp },
};

function levelOf(terminal: Terminal, sync: SyncInfo): { key: string; level: Level } | null {
    if (isArchived(terminal) || !terminal.isActive) return null;
    if (terminal.healthStatus === 'OFFLINE') return { key: 'offline', level: 'crit' };
    if (terminal.healthStatus !== 'ONLINE') return { key: 'unknown', level: 'neutral' };

    switch (sync.kind) {
        case 'pushNoToken':
            return { key: 'pushNoToken', level: 'warn' };
        case 'pushWaiting':
            return { key: 'pushWaiting', level: 'warn' };
        case 'pushActive':
            return { key: 'pushActive', level: 'ok' };
        case 'pushIdle':
            return { key: 'pushIdle', level: 'warn' };
        case 'delayed':
            return { key: 'delayed', level: 'crit' };
        case 'notStarted':
        case 'pending':
            return { key: 'notStarted', level: 'warn' };
        case 'healthy':
            return { key: 'healthy', level: 'ok' };
        default:
            return { key: 'unknown', level: 'neutral' };
    }
}

/** Bitta aniq xulosa: terminal ishlayaptimi va keyingi qadam nima. */
export function TerminalStatusSummary({ terminal, sync }: { terminal: Terminal; sync: SyncInfo }) {
    const { t } = useTranslation();
    const state = levelOf(terminal, sync);
    if (!state) return null;

    const { box, icon, Icon } = STYLE[state.level];
    const showError = terminal.healthStatus === 'OFFLINE' && terminal.lastError;

    return (
        <div role="status" className={cn('flex items-start gap-3 rounded-xl border p-4', box)}>
            <Icon aria-hidden="true" className={cn('mt-0.5 size-6 shrink-0', icon)} />
            <div className="min-w-0 space-y-1">
                <p className="font-heading text-base font-bold">{t(`terminals.summary.${state.key}.title`)}</p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {t(`terminals.summary.${state.key}.hint`, { ago: sync.delay ?? '' })}
                </p>
                {showError && (
                    <p className="text-xs [overflow-wrap:anywhere]">
                        <span className="font-semibold">{t('terminals.summary.lastError')}: </span>
                        {terminal.lastError}
                    </p>
                )}
            </div>
        </div>
    );
}

