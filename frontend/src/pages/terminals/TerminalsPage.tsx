import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    Clock3,
    Layers,
    Plus,
    RefreshCw,
    ScanFace,
    Search,
    SlidersHorizontal,
    Wifi,
    WifiOff,
    X,
} from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { CreateTerminalForm } from '@/components/terminals/CreateTerminalForm';
import { EditTerminalForm } from '@/components/terminals/EditTerminalForm';
import { TerminalBulkActions } from '@/components/terminals/TerminalBulkActions';
import { TerminalDetailsDialog } from '@/components/terminals/TerminalDetailsDialog';
import { TerminalList } from '@/components/terminals/TerminalList';
import { isArchived, syncInfo } from '@/components/terminals/terminal-status';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { authorizedDelete, authorizedPost } from '@/lib/auth-session';
import { formatNumber } from '@/lib/date';
import { schoolScopeOptions } from '@/lib/school-scope';
import { cn } from '@/lib/utils';
import type { School } from '@/types/school';
import type {
    Terminal,
    TerminalDirection,
    TerminalMonitoringResponse,
    TerminalsPageResponse,
} from '@/types/terminal';

type ArchiveStatus = 'ACTIVE' | 'ARCHIVED' | 'ALL';
type ActionMode = 'archive' | 'restore';

const PAGE_SIZES = [10, 20, 50, 100];
const ARCHIVE_STATUSES: ArchiveStatus[] = ['ACTIVE', 'ARCHIVED', 'ALL'];

function KpiCard({
    label,
    value,
    hint,
    icon: Icon,
    tone,
    loading,
}: {
    label: string;
    value: number;
    hint?: string;
    icon: LucideIcon;
    tone: 'primary' | 'success' | 'danger' | 'warning';
    loading: boolean;
}) {
    const tones = {
        primary: 'bg-primary/12 text-primary',
        success: 'bg-success/14 text-success',
        danger: 'bg-destructive/12 text-destructive',
        warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning),var(--foreground)_45%)]',
    };
    return (
        <Card className="gap-0 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
                    {loading ? (
                        <Skeleton className="mt-2 h-8 w-14" />
                    ) : (
                        <p className="mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl">{formatNumber(value)}</p>
                    )}
                </div>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
                    <Icon aria-hidden="true" className="size-5" />
                </span>
            </div>
            {hint && <p className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </Card>
    );
}

export function TerminalsPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const role = session?.profile.role;
    const canManage = role === 'SUPER_ADMIN';
    const canSelectRegion = role === 'SUPER_ADMIN';
    const canSelectDistrict = canSelectRegion || role === 'REGION_ADMIN';
    const canSelectSchool = canSelectDistrict || role === 'DISTRICT_ADMIN';

    const [now, setNow] = useState(() => Date.now());
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [direction, setDirection] = useState<TerminalDirection | ''>('');
    const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>('ACTIVE');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [selected, setSelected] = useState<Terminal | null>(null);
    const [editing, setEditing] = useState<Terminal | null>(null);
    const [action, setAction] = useState<{ terminal: Terminal; mode: ActionMode } | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [success, setSuccess] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Qidiruv: yozish to‘xtagach 400 ms o‘tib qo‘llanadi.
    useEffect(() => {
        const value = searchInput.trim();
        if (value === search) return;
        const id = window.setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 400);
        return () => window.clearTimeout(id);
    }, [searchInput, search]);

    // Muvaffaqiyat xabari 6 soniyadan keyin yo‘qoladi.
    useEffect(() => {
        if (!success) return;
        const id = window.setTimeout(() => setSuccess(''), 6000);
        return () => window.clearTimeout(id);
    }, [success]);

    const schools = useApiQuery<School[]>('/schools');
    const scope = schoolScopeOptions(schools.data, regionId, districtId);

    const params = new URLSearchParams({ page: String(page), limit: String(limit), archiveStatus });
    if (regionId) params.set('regionId', regionId);
    if (districtId) params.set('districtId', districtId);
    if (schoolId) params.set('schoolId', schoolId);
    if (direction) params.set('direction', direction);
    if (search) params.set('search', search);

    const terminals = useApiQuery<TerminalsPageResponse>(`/terminals?${params.toString()}`);
    const monitoring = useApiQuery<TerminalMonitoringResponse>(`/terminals/monitoring?${params.toString()}`);
    const monitoringById = new Map(monitoring.data?.data.map((item) => [item.id, item]) ?? []);

    // Backend HealthCheck’ni 2 daqiqada bajaradi: ro‘yxat 30 s, event statistikasi 60 s da yangilanadi.
    useInterval(() => {
        setNow(Date.now());
        terminals.retry();
    }, 30_000);
    useInterval(monitoring.retry, 60_000);

    const rows = terminals.data?.data ?? [];
    const pageIds = rows.filter((terminal) => !isArchived(terminal)).map((terminal) => terminal.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    const somePageSelected = !allPageSelected && pageIds.some((id) => selectedIds.includes(id));

    const kpi = {
        online: rows.filter((terminal) => !isArchived(terminal) && terminal.isActive && terminal.healthStatus === 'ONLINE').length,
        offline: rows.filter((terminal) => !isArchived(terminal) && terminal.isActive && terminal.healthStatus === 'OFFLINE').length,
        delayed: rows.filter((terminal) => syncInfo(terminal, now, t).kind === 'delayed').length,
    };

    const hasFilters = Boolean(regionId || districtId || schoolId || direction || search || archiveStatus !== 'ACTIVE');
    const activeSelectFilters = [regionId, districtId, schoolId, direction].filter(Boolean).length;
    const refreshing = terminals.refreshing || monitoring.refreshing;

    function toggleTerminal(id: number, checked: boolean) {
        setSelectedIds((previous) =>
            checked ? (previous.includes(id) ? previous : [...previous, id]) : previous.filter((item) => item !== id),
        );
    }

    function togglePage(checked: boolean) {
        setSelectedIds((previous) =>
            checked ? Array.from(new Set([...previous, ...pageIds])) : previous.filter((id) => !pageIds.includes(id)),
        );
    }

    function refresh() {
        setNow(Date.now());
        terminals.retry();
        monitoring.retry();
    }

    function resetFilters() {
        setRegionId('');
        setDistrictId('');
        setSchoolId('');
        setDirection('');
        setSearchInput('');
        setSearch('');
        setArchiveStatus('ACTIVE');
        setPage(1);
    }

    function openArchiveAction(terminal: Terminal) {
        setAction({ terminal, mode: isArchived(terminal) ? 'restore' : 'archive' });
        setActionError('');
    }

    async function confirmArchiveAction() {
        if (!action || actionBusy) return;
        setActionBusy(true);
        setActionError('');
        try {
            if (action.mode === 'archive') {
                await authorizedDelete(`/terminals/${action.terminal.id}`);
                setSuccess(t('terminals.archiveDialog.archived'));
                setSelectedIds((previous) => previous.filter((id) => id !== action.terminal.id));
            } else {
                await authorizedPost(`/terminals/${action.terminal.id}/restore`, {});
                setSuccess(t('terminals.archiveDialog.restored'));
            }
            setAction(null);
            setSelected(null);
            refresh();
        } catch (caught: unknown) {
            setActionError(caught instanceof Error ? caught.message : t('terminals.archiveDialog.failed'));
        } finally {
            setActionBusy(false);
        }
    }

    return (
        <div className={cn('min-w-0 space-y-5', canManage && selectedIds.length > 0 && 'pb-24')}>
            <PageHeader
                eyebrow={t('terminals.eyebrow')}
                title={t('terminals.title')}
                description={t('terminals.page.description')}
                actions={canManage ? (
                    <>
                        <Button asChild variant="outline">
                            <Link to="/terminals/person-sync-monitoring">
                                <Activity aria-hidden="true" />
                                {t('terminals.page.monitoring')}
                            </Link>
                        </Button>
                        <Button type="button" onClick={() => setCreateOpen(true)}>
                            <Plus aria-hidden="true" />
                            {t('terminals.add')}
                        </Button>
                    </>
                ) : undefined}
            />

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <section aria-label={t('terminals.kpi.total')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label={t('terminals.kpi.total')}
                    value={terminals.data?.total ?? 0}
                    icon={Layers}
                    tone="primary"
                    loading={terminals.loading}
                />
                <KpiCard
                    label={t('terminals.kpi.online')}
                    value={kpi.online}
                    hint={t('terminals.kpi.onPage')}
                    icon={Wifi}
                    tone="success"
                    loading={terminals.loading}
                />
                <KpiCard
                    label={t('terminals.kpi.offline')}
                    value={kpi.offline}
                    hint={t('terminals.kpi.onPage')}
                    icon={WifiOff}
                    tone="danger"
                    loading={terminals.loading}
                />
                <KpiCard
                    label={t('terminals.kpi.delayed')}
                    value={kpi.delayed}
                    hint={t('terminals.kpi.onPage')}
                    icon={Clock3}
                    tone="warning"
                    loading={terminals.loading}
                />
            </section>

            <Card className="min-w-0 gap-0 py-0">
                {/* Filtrlar */}
                <div className="space-y-3 border-b bg-muted/20 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
                        <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        setSearch(searchInput.trim());
                                        setPage(1);
                                    }
                                }}
                                aria-label={t('terminals.filters.search')}
                                placeholder={t('terminals.filters.searchPlaceholder')}
                                className="bg-background pr-9 pl-9"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => setSearchInput('')}
                                    aria-label={t('common.clearSearch')}
                                    className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <X aria-hidden="true" className="size-3.5" />
                                </button>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="relative bg-background sm:hidden"
                            aria-expanded={filtersOpen}
                            onClick={() => setFiltersOpen((open) => !open)}
                        >
                            <SlidersHorizontal aria-hidden="true" />
                            <span className="sr-only">{t('terminals.filters.toggle')}</span>
                            {activeSelectFilters > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                                    {activeSelectFilters}
                                </span>
                            )}
                        </Button>
                        </div>
                        {canSelectRegion && (
                            <div className={cn('xl:col-span-2', !filtersOpen && 'max-sm:hidden')}>
                                <SelectField
                                    value={regionId}
                                    onValueChange={(value) => {
                                        setRegionId(value);
                                        setDistrictId('');
                                        setSchoolId('');
                                        setPage(1);
                                    }}
                                    emptyOption={t('terminals.filters.allRegions')}
                                    options={scope.regions}
                                    searchable
                                    aria-label={t('terminals.filters.region')}
                                />
                            </div>
                        )}
                        {canSelectDistrict && (
                            <div className={cn('xl:col-span-2', !filtersOpen && 'max-sm:hidden')}>
                                <SelectField
                                    value={districtId}
                                    onValueChange={(value) => {
                                        setDistrictId(value);
                                        setSchoolId('');
                                        setPage(1);
                                    }}
                                    emptyOption={t('terminals.filters.allDistricts')}
                                    options={scope.districts}
                                    searchable
                                    aria-label={t('terminals.filters.district')}
                                />
                            </div>
                        )}
                        {canSelectSchool && (
                            <div className={cn('xl:col-span-2', !filtersOpen && 'max-sm:hidden')}>
                                <SelectField
                                    value={schoolId}
                                    onValueChange={(value) => {
                                        setSchoolId(value);
                                        setPage(1);
                                    }}
                                    emptyOption={t('terminals.filters.allSchools')}
                                    options={scope.schools}
                                    searchable
                                    aria-label={t('terminals.filters.school')}
                                />
                            </div>
                        )}
                        <div className={cn('xl:col-span-2', !filtersOpen && 'max-sm:hidden')}>
                            <SelectField
                                value={direction}
                                onValueChange={(value) => {
                                    if (value === '' || value === 'IN' || value === 'OUT') {
                                        setDirection(value);
                                        setPage(1);
                                    }
                                }}
                                emptyOption={t('terminals.filters.allDirections')}
                                options={[
                                    { value: 'IN', label: t('terminals.directions.IN') },
                                    { value: 'OUT', label: t('terminals.directions.OUT') },
                                ]}
                                aria-label={t('terminals.direction')}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div
                            role="radiogroup"
                            aria-label={t('terminals.filters.archive')}
                            className="inline-flex rounded-xl border bg-background p-1"
                        >
                            {ARCHIVE_STATUSES.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={archiveStatus === value}
                                    onClick={() => {
                                        setArchiveStatus(value);
                                        setPage(1);
                                    }}
                                    className={cn(
                                        'h-8 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        archiveStatus === value
                                            ? 'bg-brand-gradient text-white shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    {t(`terminals.filters.archiveOptions.${value}`)}
                                </button>
                            ))}
                        </div>
                        {hasFilters && (
                            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                                <X aria-hidden="true" />
                                {t('terminals.filters.reset')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Ro‘yxat sarlavhasi */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
                    <div className="flex min-w-0 items-center gap-3">
                        {canManage && pageIds.length > 0 && (
                            <Checkbox
                                className="xl:hidden"
                                aria-label={t('terminals.list.selectAll')}
                                checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                                onCheckedChange={(checked) => togglePage(checked === true)}
                            />
                        )}
                        <div className="min-w-0">
                            <h2 className="flex items-center gap-2 text-base font-semibold">
                                <ScanFace aria-hidden="true" className="size-5 text-primary" />
                                {t('terminals.list.title')}
                                {terminals.data && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-xs font-semibold tabular-nums text-muted-foreground">
                                        {formatNumber(terminals.data.total)}
                                    </span>
                                )}
                            </h2>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                                <span
                                    aria-hidden="true"
                                    className={cn('size-1.5 rounded-full', refreshing ? 'animate-pulse bg-primary' : 'bg-success')}
                                />
                                {refreshing ? t('terminals.list.refreshing') : t('terminals.list.autoRefresh')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-32">
                            <SelectField
                                value={String(limit)}
                                onValueChange={(value) => {
                                    setLimit(Number(value));
                                    setPage(1);
                                }}
                                options={PAGE_SIZES.map((size) => ({
                                    value: String(size),
                                    label: t('terminals.list.perPage', { count: size }),
                                }))}
                                aria-label={t('terminals.list.perPageLabel')}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={refresh}
                            disabled={refreshing}
                            aria-label={t('common.refresh')}
                            title={t('common.refresh')}
                        >
                            <RefreshCw aria-hidden="true" className={cn(refreshing && 'animate-spin')} />
                        </Button>
                    </div>
                </div>

                <div className="space-y-4 p-4">
                    {monitoring.error && !terminals.loading && (
                        <p role="alert" className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">
                            {t('terminals.list.monitoringError', { error: monitoring.error })}
                        </p>
                    )}

                    {terminals.loading ? (
                        <LoadingState label={t('terminals.loading')} rows={limit > 10 ? 8 : 5} className="border-0 p-0 sm:p-0" />
                    ) : terminals.error || !terminals.data ? (
                        <ErrorState message={terminals.error || t('terminals.list.loadFailed')} onRetry={refresh} />
                    ) : rows.length === 0 ? (
                        <EmptyState
                            icon={ScanFace}
                            title={t('terminals.list.notFoundTitle')}
                            description={t('terminals.list.notFound')}
                            action={hasFilters ? (
                                <Button type="button" variant="outline" onClick={resetFilters}>
                                    {t('common.clearFilters')}
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <>
                            <TerminalList
                                terminals={rows}
                                monitoringById={monitoringById}
                                now={now}
                                canManage={canManage}
                                selectedIds={selectedIds}
                                onToggle={toggleTerminal}
                                onTogglePage={togglePage}
                                onOpen={setSelected}
                                onEdit={setEditing}
                                onArchiveAction={openArchiveAction}
                            />
                            <Pagination
                                page={terminals.data.page}
                                totalPages={Math.max(1, terminals.data.totalPages)}
                                total={terminals.data.total}
                                pageSize={terminals.data.limit}
                                shownCount={rows.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </div>
            </Card>

            {/* Tanlov paneli: pastda doim ko‘rinib turadi */}
            {canManage && selectedIds.length > 0 && (
                <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 md:left-[calc(76px+1.5rem)] lg:right-8 lg:left-[calc(272px+2rem)]">
                    <div
                        role="region"
                        aria-label={t('terminals.selection.open')}
                        className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border bg-card/95 p-2 pl-4 shadow-xl shadow-black/10 backdrop-blur supports-[backdrop-filter]:bg-card/85"
                    >
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {t('terminals.selection.count', { count: selectedIds.length })}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds([])}
                            aria-label={t('terminals.selection.clear')}
                        >
                            <X aria-hidden="true" />
                            <span className="max-sm:hidden">{t('terminals.selection.clear')}</span>
                        </Button>
                        <Button type="button" size="sm" onClick={() => setBulkOpen(true)}>
                            <Layers aria-hidden="true" />
                            {t('terminals.selection.open')}
                        </Button>
                    </div>
                </div>
            )}

            {selected && (
                <TerminalDetailsDialog
                    terminal={selected}
                    canManage={canManage}
                    now={now}
                    onClose={() => setSelected(null)}
                    onChanged={refresh}
                    onEdit={(terminal) => {
                        setSelected(null);
                        setEditing(terminal);
                    }}
                    onArchiveAction={openArchiveAction}
                />
            )}

            <Dialog open={bulkOpen && selectedIds.length > 0} onOpenChange={setBulkOpen}>
                <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('terminals.bulk.title')}</DialogTitle>
                        <DialogDescription>{t('terminals.bulk.description', { count: selectedIds.length })}</DialogDescription>
                    </DialogHeader>
                    <TerminalBulkActions terminalIds={selectedIds} onSubmitted={refresh} />
                </DialogContent>
            </Dialog>

            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('terminals.page.editTitle')}</DialogTitle>
                        <DialogDescription>{t('terminals.page.editDescription')}</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <EditTerminalForm
                            key={editing.id}
                            terminal={editing}
                            onCancel={() => setEditing(null)}
                            onSaved={() => {
                                setEditing(null);
                                setSuccess(t('terminals.page.updated'));
                                refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('terminals.page.createTitle')}</DialogTitle>
                        <DialogDescription>{t('terminals.page.createDescription')}</DialogDescription>
                    </DialogHeader>
                    {createOpen && (
                        <CreateTerminalForm
                            onCancel={() => setCreateOpen(false)}
                            onSaved={() => {
                                setCreateOpen(false);
                                setSuccess(t('terminals.page.created'));
                                setPage(1);
                                refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={action !== null} onOpenChange={(open) => { if (!open && !actionBusy) setAction(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {action?.mode === 'restore'
                                ? t('terminals.archiveDialog.restoreTitle')
                                : t('terminals.archiveDialog.archiveTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium text-foreground">{action?.terminal.name}</span>{' '}
                            <span className="font-mono">#{action?.terminal.id}</span> — {action?.terminal.school.name}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p className="text-sm">
                        {action?.mode === 'restore'
                            ? t('terminals.archiveDialog.restoreText')
                            : t('terminals.archiveDialog.archiveText')}
                    </p>
                    {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionBusy}>{t('common.cancel')}</AlertDialogCancel>
                        <Button
                            type="button"
                            disabled={actionBusy}
                            variant={action?.mode === 'archive' ? 'destructive' : 'default'}
                            onClick={() => void confirmArchiveAction()}
                        >
                            {actionBusy
                                ? t('terminals.archiveDialog.busy')
                                : action?.mode === 'archive'
                                    ? t('terminals.archiveDialog.confirmArchive')
                                    : t('terminals.archiveDialog.confirmRestore')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
