import { useState } from 'react';
import { Plus, RefreshCw, School as SchoolIcon, Webhook } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { BroadcastCard } from '@/components/parent-notify/BroadcastCard';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { TimePicker } from '@/components/common/TimePicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost, authorizedPut } from '@/lib/auth-session';
import { formatDateTime, formatNumber } from '@/lib/date';
import type { School } from '@/types/school';

interface Status {
    configured: boolean;
    hasPublicUrl: boolean;
    publicUrl: string | null;
    bot: { username: string | null } | null;
    webhook: { url: string; pending: number; lastError: string | null } | null;
    error: string | null;
    links: { total: number; blocked: number; withPhone: number };
    messagesToday: Record<string, number>;
}

interface PilotSchool {
    schoolId: number;
    name: string;
    district: string;
    enabled: boolean;
    absentTime: string;
    graceMinutes: number;
    showEventPhotos: boolean;
    students: number;
    linked: number;
}

interface MessageRow {
    id: number;
    kind: string;
    status: string;
    attempts: number;
    error: string | null;
    createdAt: string;
    student: string;
}

const STATUS_TONE: Record<string, StatusTone> = { SENT: 'success', PENDING: 'info', FAILED: 'danger', SKIPPED: 'warning' };

function SchoolRow({ school, onSaved }: { school: PilotSchool; onSaved: () => void }) {
    const { t } = useTranslation();
    const [time, setTime] = useState(school.absentTime);
    const [grace, setGrace] = useState(String(school.graceMinutes));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const { confirm, dialog } = useConfirm();

    async function save(patch: { enabled?: boolean; showEventPhotos?: boolean }) {
        setBusy(true);
        setError('');
        try {
            await authorizedPut(`/parent-notify/schools/${school.schoolId}`, {
                enabled: patch.enabled ?? school.enabled,
                absentTime: time,
                graceMinutes: Number(grace) || 0,
                showEventPhotos: patch.showEventPhotos ?? school.showEventPhotos,
            });
            onSaved();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        } finally {
            setBusy(false);
        }
    }

    const dirty = time !== school.absentTime || Number(grace) !== school.graceMinutes;
    return (
        <TableRow>
            <TableCell className="pl-4 whitespace-normal">
                <span className="font-medium [overflow-wrap:anywhere]">{school.name}</span>
                <span className="block text-xs text-muted-foreground">{school.district}</span>
                {error && <span className="block text-xs text-destructive">{error}</span>}
            </TableCell>
            <TableCell className="tabular-nums">{formatNumber(school.students)}</TableCell>
            <TableCell className="tabular-nums">{formatNumber(school.linked)}</TableCell>
            <TableCell>
                <TimePicker value={time} onChange={(event) => setTime(event.target.value)} disabled={busy} aria-label={t('parentAdmin.schools.absentTime')} />
            </TableCell>
            <TableCell>
                <Input
                    inputMode="numeric"
                    className="w-20"
                    value={grace}
                    onChange={(event) => setGrace(event.target.value.replace(/\D/g, '').slice(0, 3))}
                    disabled={busy}
                    aria-label={t('parentAdmin.schools.grace')}
                />
            </TableCell>
            <TableCell>
                <Switch checked={school.enabled} disabled={busy} onCheckedChange={(checked) => void save({ enabled: checked })} aria-label={t('parentAdmin.schools.enabled')} />
            </TableCell>
            <TableCell>
                <Switch
                    checked={school.showEventPhotos}
                    disabled={busy}
                    aria-label={t('parentAdmin.schools.eventPhotos')}
                    onCheckedChange={(checked) => {
                        if (!checked) return void save({ showEventPhotos: false });
                        void confirm({
                            title: t('parentAdmin.schools.photosConfirmTitle'),
                            description: t('parentAdmin.schools.photosConfirmText', { name: school.name }),
                            confirmLabel: t('parentAdmin.schools.eventPhotos'),
                        }).then((ok) => {
                            if (ok) void save({ showEventPhotos: true });
                        });
                    }}
                />
                {dialog}
            </TableCell>
            <TableCell className="pr-4">
                <Button type="button" size="sm" variant="outline" disabled={busy || !dirty} onClick={() => void save({})}>
                    {t('parentAdmin.save')}
                </Button>
            </TableCell>
        </TableRow>
    );
}

/** Ota-onalarga Telegram xabari: bot holati, sinov maktablari va oxirgi xabarlar (Bosh administrator). */
export function ParentNotifyPage() {
    const { t } = useTranslation();
    const { confirm, dialog: confirmDialog } = useConfirm();
    const status = useApiQuery<Status>('/parent-notify/status');
    const schools = useApiQuery<PilotSchool[]>('/parent-notify/schools');
    const messages = useApiQuery<MessageRow[]>('/parent-notify/messages');
    const allSchools = useApiQuery<School[]>('/schools');
    const [picked, setPicked] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    function refresh() {
        status.retry();
        schools.retry();
        messages.retry();
    }

    async function setup() {
        setBusy(true);
        setError('');
        try {
            await authorizedPost('/parent-notify/webhook/setup', {});
            status.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function addSchool() {
        if (!picked) return;
        setBusy(true);
        setError('');
        try {
            await authorizedPut(`/parent-notify/schools/${picked}`, { enabled: true, absentTime: '09:30', graceMinutes: 30 });
            setPicked('');
            schools.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function enableAll() {
        const ok = await confirm({
            title: t('parentAdmin.schools.enableAllTitle'),
            description: t('parentAdmin.schools.enableAllText'),
            confirmLabel: t('parentAdmin.schools.enableAll'),
        });
        if (!ok) return;
        setBusy(true);
        setError('');
        try {
            await authorizedPost('/parent-notify/schools/enable-all', {});
            schools.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        } finally {
            setBusy(false);
        }
    }

    const existing = new Set((schools.data ?? []).map((item) => item.schoolId));
    const options = (allSchools.data ?? [])
        .filter((school) => !existing.has(school.id))
        .map((school) => ({ value: String(school.id), label: `${school.name} · ${school.district.name}`, keywords: `${school.name} ${school.district.name}` }));
    const s = status.data;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('parentAdmin.title')}
                description={t('parentAdmin.description')}
                actions={
                    <Button type="button" variant="outline" onClick={refresh}>
                        <RefreshCw aria-hidden="true" />
                        {t('parentAdmin.refresh')}
                    </Button>
                }
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Card className="gap-4 p-4 sm:p-5">
                <h2 className="font-heading text-base font-bold">{t('parentAdmin.bot.title')}</h2>
                {status.loading && !s ? (
                    <LoadingState rows={2} />
                ) : status.error && !s ? (
                    <ErrorState message={status.error} onRetry={status.retry} />
                ) : s ? (
                    <>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('parentAdmin.bot.token')}</dt>
                                <dd className="mt-1">
                                    <StatusBadge tone={s.configured ? 'success' : 'danger'}>{s.configured ? t('parentAdmin.bot.configured') : t('parentAdmin.bot.notConfigured')}</StatusBadge>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('parentAdmin.bot.username')}</dt>
                                <dd className="mt-1 font-medium">{s.bot?.username ? `@${s.bot.username}` : '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('parentAdmin.bot.webhook')}</dt>
                                <dd className="mt-1 text-xs [overflow-wrap:anywhere]">
                                    {s.webhook?.url ? (
                                        <>
                                            <StatusBadge tone="success">{t('parentAdmin.bot.webhookOn')}</StatusBadge>
                                            <span className="mt-1 block text-muted-foreground">{s.webhook.url}</span>
                                        </>
                                    ) : (
                                        <StatusBadge tone="warning">{t('parentAdmin.bot.webhookOff')}</StatusBadge>
                                    )}
                                    {s.webhook?.lastError && <span className="mt-1 block text-destructive">{s.webhook.lastError}</span>}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('parentAdmin.bot.parents')}</dt>
                                <dd className="mt-1 font-medium tabular-nums">
                                    {t('parentAdmin.bot.parentsValue', { total: s.links.withPhone, blocked: s.links.blocked })}
                                </dd>
                            </div>
                        </dl>
                        {!s.configured && <p className="rounded-xl border border-dashed p-3 text-xs leading-5 text-muted-foreground">{t('parentAdmin.bot.envHint')}</p>}
                        {s.configured && !s.hasPublicUrl && <p className="text-xs text-destructive">{t('parentAdmin.bot.publicUrlHint')}</p>}
                        {s.error && <p className="text-xs text-destructive">{s.error}</p>}
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" variant="outline" disabled={busy || !s.configured || !s.hasPublicUrl} onClick={() => void setup()}>
                                <Webhook aria-hidden="true" />
                                {t('parentAdmin.bot.setup')}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                {t('parentAdmin.bot.today', {
                                    sent: s.messagesToday.SENT ?? 0,
                                    pending: s.messagesToday.PENDING ?? 0,
                                    failed: (s.messagesToday.FAILED ?? 0) + (s.messagesToday.SKIPPED ?? 0),
                                })}
                            </p>
                        </div>
                    </>
                ) : null}
            </Card>

            <BroadcastCard />

            <Card className="gap-4 p-4 sm:p-5">
                <div>
                    <h2 className="font-heading text-base font-bold">{t('parentAdmin.schools.title')}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('parentAdmin.schools.description')}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 basis-64">
                        <SelectField value={picked} onValueChange={setPicked} options={options} placeholder={t('parentAdmin.schools.pick')} aria-label={t('parentAdmin.schools.pick')} />
                    </div>
                    <Button type="button" disabled={busy || !picked} onClick={() => void addSchool()}>
                        <Plus aria-hidden="true" />
                        {t('parentAdmin.schools.add')}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void enableAll()}>
                        <SchoolIcon aria-hidden="true" />
                        {t('parentAdmin.schools.enableAll')}
                    </Button>
                    {confirmDialog}
                </div>
                {schools.loading && !schools.data ? (
                    <LoadingState rows={2} />
                ) : schools.data && schools.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('parentAdmin.schools.empty')}</p>
                ) : schools.data ? (
                    <div className="overflow-x-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{t('parentAdmin.schools.school')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.students')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.linked')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.absentTime')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.grace')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.enabled')}</TableHead>
                                    <TableHead>{t('parentAdmin.schools.eventPhotos')}</TableHead>
                                    <TableHead className="pr-4" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schools.data.map((school) => (
                                    <SchoolRow key={`${school.schoolId}:${school.enabled}:${school.absentTime}:${school.graceMinutes}:${school.showEventPhotos}`} school={school} onSaved={() => schools.retry()} />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
            </Card>

            <Card className="gap-4 p-4 sm:p-5">
                <h2 className="font-heading text-base font-bold">{t('parentAdmin.messages.title')}</h2>
                {messages.data && messages.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('parentAdmin.messages.empty')}</p>
                ) : messages.data ? (
                    <div className="max-h-96 overflow-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{t('parentAdmin.messages.time')}</TableHead>
                                    <TableHead>{t('parentAdmin.messages.student')}</TableHead>
                                    <TableHead>{t('parentAdmin.messages.kind')}</TableHead>
                                    <TableHead className="pr-4">{t('parentAdmin.messages.status')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {messages.data.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="pl-4 tabular-nums">{formatDateTime(row.createdAt)}</TableCell>
                                        <TableCell className="whitespace-normal">{row.student || '—'}</TableCell>
                                        <TableCell>{t(`parentAdmin.messages.kinds.${row.kind}`, { defaultValue: row.kind })}</TableCell>
                                        <TableCell className="pr-4 whitespace-normal">
                                            <StatusBadge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`parentAdmin.messages.statuses.${row.status}`, { defaultValue: row.status })}</StatusBadge>
                                            {row.error && <span className="mt-1 block text-xs text-destructive [overflow-wrap:anywhere]">{row.error}</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
