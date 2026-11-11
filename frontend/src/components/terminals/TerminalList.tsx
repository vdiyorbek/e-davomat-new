import { Archive, ArchiveRestore, Building2, Info, LogIn, LogOut, Pencil, ScanFace } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Terminal, TerminalMonitoringItem } from '@/types/terminal';

import { connectionBadge, isArchived, syncInfo, systemBadge } from './terminal-status';

export interface TerminalListProps {
    terminals: Terminal[];
    monitoringById: Map<number, TerminalMonitoringItem>;
    now: number;
    canManage: boolean;
    selectedIds: number[];
    onToggle: (id: number, checked: boolean) => void;
    onTogglePage: (checked: boolean) => void;
    onOpen: (terminal: Terminal) => void;
    onEdit: (terminal: Terminal) => void;
    onArchiveAction: (terminal: Terminal) => void;
}

/**
 * Terminallar ro‘yxati:
 *  • ≥ 1280px — ixcham jadval (8 ustun, gorizontal aylantirishsiz);
 *  • < 1280px — kartalar to‘ri (telefonda 1, planshetda 2 ustun).
 */
export function TerminalList(props: TerminalListProps) {
    return (
        <>
            <div className="hidden xl:block">
                <TerminalTable {...props} />
            </div>
            <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
                {props.terminals.map((terminal) => (
                    <li key={terminal.id} className="min-w-0">
                        <TerminalCard terminal={terminal} {...props} />
                    </li>
                ))}
            </ul>
        </>
    );
}

function DirectionChip({ direction }: { direction: Terminal['direction'] }) {
    const { t } = useTranslation();
    const Icon = direction === 'IN' ? LogIn : LogOut;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                direction === 'IN' ? 'bg-success/12 text-success' : 'bg-violet/12 text-violet',
            )}
        >
            <Icon aria-hidden="true" className="size-3" />
            {t(`terminals.directions.${direction}`)}
        </span>
    );
}

function IconAction({
    label,
    onClick,
    children,
    tone,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    tone?: 'danger';
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={label}
                    onClick={onClick}
                    className={cn(
                        'text-muted-foreground hover:text-foreground',
                        tone === 'danger' && 'hover:bg-destructive/10 hover:text-destructive',
                    )}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function RowActions({
    terminal,
    canManage,
    onOpen,
    onEdit,
    onArchiveAction,
    hideDetails,
}: Pick<TerminalListProps, 'canManage' | 'onOpen' | 'onEdit' | 'onArchiveAction'> & { terminal: Terminal; hideDetails?: boolean }) {
    const { t } = useTranslation();
    const archived = isArchived(terminal);
    const name = terminal.name;

    return (
        <div className="flex items-center justify-end gap-0.5">
            {!hideDetails && (
                <IconAction label={t('terminals.actions.detailsOf', { name })} onClick={() => onOpen(terminal)}>
                    <Info aria-hidden="true" />
                </IconAction>
            )}
            {canManage && !archived && (
                <IconAction label={t('terminals.actions.editOf', { name })} onClick={() => onEdit(terminal)}>
                    <Pencil aria-hidden="true" />
                </IconAction>
            )}
            {canManage && (
                <IconAction
                    label={t(archived ? 'terminals.actions.restoreOf' : 'terminals.actions.archiveOf', { name })}
                    onClick={() => onArchiveAction(terminal)}
                    tone={archived ? undefined : 'danger'}
                >
                    {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                </IconAction>
            )}
        </div>
    );
}

function EventsCell({ stats }: { stats: TerminalMonitoringItem | undefined }) {
    const { t } = useTranslation();
    if (!stats) return <span className="text-muted-foreground">—</span>;
    return (
        <div className="min-w-0">
            <div className="font-semibold tabular-nums">{formatNumber(stats.totalEvents)}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
                {t('terminals.events.repeated', {
                    value: formatNumber(stats.repeatedEvents),
                    percent: stats.repeatedPercent.toFixed(1),
                })}
            </div>
        </div>
    );
}

function TerminalTable({
    terminals,
    monitoringById,
    now,
    canManage,
    selectedIds,
    onToggle,
    onTogglePage,
    onOpen,
    onEdit,
    onArchiveAction,
}: TerminalListProps) {
    const { t } = useTranslation();
    const selectable = terminals.filter((terminal) => !isArchived(terminal));
    const allSelected = selectable.length > 0 && selectable.every((terminal) => selectedIds.includes(terminal.id));
    const someSelected = !allSelected && selectable.some((terminal) => selectedIds.includes(terminal.id));

    const th = 'px-3 py-2.5 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase';

    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[960px] table-fixed text-sm">
                <colgroup>
                    {canManage && <col className="w-11" />}
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-28" />
                </colgroup>
                <thead className="border-b bg-muted/50">
                    <tr>
                        {canManage && (
                            <th className={th}>
                                <Checkbox
                                    aria-label={t('terminals.list.selectAll')}
                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                    disabled={selectable.length === 0}
                                    onCheckedChange={(checked) => onTogglePage(checked === true)}
                                />
                            </th>
                        )}
                        <th className={th}>{t('terminals.columns.terminal')}</th>
                        <th className={th}>{t('terminals.columns.school')}</th>
                        <th className={th}>{t('terminals.columns.address')}</th>
                        <th className={th}>{t('terminals.columns.status')}</th>
                        <th className={th}>{t('terminals.columns.sync')}</th>
                        <th className={th}>{t('terminals.columns.events')}</th>
                        <th className={cn(th, 'text-right')}>{t('terminals.columns.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {terminals.map((terminal) => {
                        const archived = isArchived(terminal);
                        const selected = selectedIds.includes(terminal.id);
                        const connection = connectionBadge(terminal, t);
                        const system = systemBadge(terminal, t);
                        const sync = syncInfo(terminal, now, t);

                        return (
                            <tr
                                key={terminal.id}
                                className={cn(
                                    'align-top transition-colors hover:bg-muted/30',
                                    selected && 'bg-primary/5 hover:bg-primary/8',
                                    archived && 'text-muted-foreground',
                                )}
                            >
                                {canManage && (
                                    <td className="px-3 py-3">
                                        <Checkbox
                                            aria-label={t('terminals.list.select', { name: terminal.name })}
                                            checked={selected}
                                            disabled={archived}
                                            onCheckedChange={(checked) => onToggle(terminal.id, checked === true)}
                                        />
                                    </td>
                                )}
                                <td className="px-3 py-3">
                                    <button
                                        type="button"
                                        onClick={() => onOpen(terminal)}
                                        className="block max-w-full truncate text-left font-semibold text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                        title={terminal.name}
                                    >
                                        {terminal.name}
                                    </button>
                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span className="font-mono">#{terminal.id}</span>
                                        <DirectionChip direction={terminal.direction} />
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="truncate font-medium" title={terminal.school.name}>
                                        {terminal.school.name}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                        {terminal.school.district.name}
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    <span className="font-mono text-xs break-all">{terminal.host}</span>
                                    <div className="text-xs text-muted-foreground">
                                        {terminal.protocol} · {terminal.port}
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col items-start gap-1">
                                        <StatusBadge tone={connection.tone}>{connection.text}</StatusBadge>
                                        <StatusBadge tone={system.tone} dot={false}>{system.text}</StatusBadge>
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge tone={sync.tone}>{sync.text}</StatusBadge>
                                    {sync.delay && (
                                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                            {t('terminals.delay.value', { value: sync.delay })}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    <EventsCell stats={monitoringById.get(terminal.id)} />
                                </td>
                                <td className="px-2 py-2.5">
                                    <RowActions
                                        terminal={terminal}
                                        canManage={canManage}
                                        onOpen={onOpen}
                                        onEdit={onEdit}
                                        onArchiveAction={onArchiveAction}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function TerminalCard({
    terminal,
    monitoringById,
    now,
    canManage,
    selectedIds,
    onToggle,
    onOpen,
    onEdit,
    onArchiveAction,
}: TerminalListProps & { terminal: Terminal }) {
    const { t } = useTranslation();
    const archived = isArchived(terminal);
    const selected = selectedIds.includes(terminal.id);
    const connection = connectionBadge(terminal, t);
    const system = systemBadge(terminal, t);
    const sync = syncInfo(terminal, now, t);
    const stats = monitoringById.get(terminal.id);

    return (
        <article
            className={cn(
                'flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.03] transition-colors',
                selected && 'border-primary/50 bg-primary/5 ring-1 ring-primary/30',
                archived && 'opacity-80',
            )}
        >
            <header className="flex items-start gap-3">
                {canManage && (
                    <Checkbox
                        className="mt-2.5"
                        aria-label={t('terminals.list.select', { name: terminal.name })}
                        checked={selected}
                        disabled={archived}
                        onCheckedChange={(checked) => onToggle(terminal.id, checked === true)}
                    />
                )}
                <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                >
                    <ScanFace className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() => onOpen(terminal)}
                        className="line-clamp-2 text-left font-heading text-base leading-snug font-bold break-words outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        title={terminal.name}
                    >
                        {terminal.name}
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">#{terminal.id}</span>
                        <DirectionChip direction={terminal.direction} />
                    </div>
                </div>
            </header>

            <div className="flex min-w-0 items-start gap-2 text-sm">
                <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <p className="truncate font-medium" title={terminal.school.name}>{terminal.school.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {terminal.school.district.name} · <span className="font-mono">{terminal.host}:{terminal.port}</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone={connection.tone}>{connection.text}</StatusBadge>
                <StatusBadge tone={system.tone} dot={false}>{system.text}</StatusBadge>
                <StatusBadge tone={sync.tone}>{sync.text}</StatusBadge>
            </div>

            <dl className="mt-auto grid grid-cols-3 divide-x rounded-lg border bg-muted/30 text-center">
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">{t('terminals.delay.label')}</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums">{sync.delay ?? '—'}</dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">{t('terminals.events.todayShort')}</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                        {stats ? formatNumber(stats.totalEvents) : '—'}
                    </dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">{t('terminals.events.repeatedShort')}</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                        {stats ? `${stats.repeatedPercent.toFixed(1)}%` : '—'}
                    </dd>
                </div>
            </dl>

            <footer className="-mx-1 -mb-1 flex items-center justify-between gap-2 border-t pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(terminal)}>
                    <Info aria-hidden="true" />
                    {t('terminals.actions.details')}
                </Button>
                {canManage && (
                    <RowActions
                        terminal={terminal}
                        canManage={canManage}
                        onOpen={onOpen}
                        onEdit={onEdit}
                        onArchiveAction={onArchiveAction}
                        hideDetails
                    />
                )}
            </footer>
        </article>
    );
}
