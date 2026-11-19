import { useEffect, useId, useState } from 'react';
import { Activity, GraduationCap, History, Presentation, Radio, ScanFace } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { LiveEventRow } from '@/components/live/LiveEventRow';
import { TerminalCamera } from '@/components/live/TerminalCamera';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { authorizedEventStream, authorizedGet } from '@/lib/auth-session';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/date';
import type { LiveEvent, LiveSummary, LiveTerminal } from '@/types/live';
import type { School } from '@/types/school';

const MAX_EVENTS = 100;
type StreamStatus = 'connecting' | 'live' | 'reconnecting';

function mergeEvents(current: LiveEvent[], incoming: LiveEvent[]): LiveEvent[] {
    const seen = new Set(current.map((event) => event.eventId));
    const fresh = incoming.filter((event) => !seen.has(event.eventId));
    return [...fresh, ...current]
        .sort((a, b) => b.eventAt.localeCompare(a.eventAt))
        .slice(0, MAX_EVENTS);
}

/**
 * Bugungi oxirgi o‘tishlar + SSE orqali yangilari, uzilganda qayta ulanadi.
 * Komponent maktab bo‘yicha `key` bilan yaratiladi — holat maktab almashganda yangidan boshlanadi.
 */
function useLiveEvents(schoolId: string) {
    const [state, setState] = useState<{ events: LiveEvent[]; freshIds: Set<string> }>({
        events: [],
        freshIds: new Set(),
    });
    const [status, setStatus] = useState<StreamStatus>('connecting');
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        let attempt = 0;

        async function run() {
            while (!controller.signal.aborted) {
                try {
                    // Har ulanishda oxirgilarini qayta olamiz — uzilish paytidagilar yo‘qolmaydi.
                    const recent = await authorizedGet<LiveEvent[]>(`/live/schools/${schoolId}/recent`, controller.signal);
                    setState((prev) => ({ events: mergeEvents(prev.events, recent), freshIds: new Set() }));

                    await authorizedEventStream(`/live/schools/${schoolId}/stream`, controller.signal, (type, data) => {
                        if (type === 'ready') {
                            attempt = 0;
                            setStatus('live');
                            setError('');
                        }
                        if (type !== 'events') return;
                        const incoming = JSON.parse(data) as LiveEvent[];
                        setState((prev) => ({
                            events: mergeEvents(prev.events, incoming),
                            freshIds: new Set(incoming.map((event) => event.eventId)),
                        }));
                    });
                } catch (err: unknown) {
                    if (controller.signal.aborted) return;
                    setError(err instanceof Error ? err.message : '');
                }

                if (controller.signal.aborted) return;
                setStatus('reconnecting');
                attempt += 1;
                await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1000 * 2 ** attempt)));
            }
        }

        void run();
        return () => controller.abort();
    }, [schoolId]);

    return { events: state.events, freshIds: state.freshIds, status, error };
}

/**
 * Bugungi jami ko‘rsatkichlar (ro‘yxat 100 ta bilan cheklangan, hisoblagichlar esa yo‘q).
 * Eski eventlar navbati efirga chiqmasa ham, hisoblagich o‘sishda davom etishi uchun
 * har 10 soniyada yangilanadi.
 */
function useLiveSummary(schoolId: string) {
    const summary = useApiQuery<LiveSummary>(`/live/schools/${schoolId}/summary`);
    useInterval(summary.retry, 10_000);
    return summary.data;
}

function LagNotice({ summary, terminals }: { summary: LiveSummary | null; terminals: LiveTerminal[] }) {
    const { t } = useTranslation();
    if (!summary?.lastEventAt) return null;
    const now = Date.parse(summary.serverTime);
    const lagMinutes = Math.floor((now - Date.parse(summary.lastEventAt)) / 60_000);
    // Terminal hozir ham so‘rov yuboryapti (ulanish bor), lekin oxirgi o‘tish eski:
    // terminal xotiradagi eski eventlarni navbat bilan yuboryapti.
    const pushing = terminals.some((terminal) => terminal.pushLastReceivedAt && now - Date.parse(terminal.pushLastReceivedAt) < 3 * 60_000);
    if (lagMinutes < 15 || !pushing) return null;
    const ago = lagMinutes >= 60 ? t('live.lag.agoHm', { h: Math.floor(lagMinutes / 60), m: lagMinutes % 60 }) : t('live.lag.agoM', { m: lagMinutes });
    return (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <History aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>{t('live.lag.text', { time: formatTime(summary.lastEventAt), ago })}</p>
        </div>
    );
}

function StatusPill({ status }: { status: StreamStatus }) {
    const { t } = useTranslation();
    return (
        <span
            role="status"
            className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
                status === 'live' ? 'border-success/40 text-success' : 'border-warning/40 text-warning',
            )}
        >
            <span aria-hidden="true" className={cn('size-2 rounded-full', status === 'live' ? 'animate-pulse bg-success' : 'bg-warning')} />
            {t(`live.status.${status}`)}
        </span>
    );
}

function LiveBoard({ schoolId }: { schoolId: string }) {
    const { t } = useTranslation();
    const terminals = useApiQuery<LiveTerminal[]>(`/live/schools/${schoolId}/terminals`);
    const { events, freshIds, status, error } = useLiveEvents(schoolId);
    const summary = useLiveSummary(schoolId);
    // Terminalning oxirgi so‘rov vaqti (kechikish xabari uchun) yangilanib turadi.
    useInterval(terminals.retry, 10_000);
    const [cameraId, setCameraId] = useState('');

    const terminalById = new Map((terminals.data ?? []).map((terminal) => [terminal.id, terminal]));
    const activeTerminals = (terminals.data ?? []).filter((terminal) => terminal.healthStatus !== 'DISABLED');
    const shownCameras = cameraId ? activeTerminals.filter((terminal) => String(terminal.id) === cameraId) : activeTerminals.slice(0, 2);

    const latest = events[0];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusPill status={status} />
                {error && status !== 'live' && <p className="text-sm text-muted-foreground">{error}</p>}
            </div>

            <LagNotice summary={summary} terminals={terminals.data ?? []} />

            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard icon={Activity} label={t('live.kpi.passes')} value={summary?.passes ?? '—'} />
                <KpiCard icon={GraduationCap} tone="success" label={t('live.kpi.students')} value={summary?.students ?? '—'} />
                <KpiCard icon={Presentation} label={t('live.kpi.teachers')} value={summary?.teachers ?? '—'} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <section aria-labelledby="live-cameras" className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <h2 id="live-cameras" className="font-heading text-lg font-bold">
                            {t('live.cameras')}
                        </h2>
                        {activeTerminals.length > 2 && (
                            <SelectField
                                value={cameraId}
                                onValueChange={setCameraId}
                                emptyOption={t('live.firstCameras')}
                                options={activeTerminals.map((terminal) => ({ value: String(terminal.id), label: terminal.name }))}
                                aria-label={t('live.chooseCamera')}
                                className="w-full sm:w-64"
                            />
                        )}
                    </div>

                    {terminals.loading && <LoadingState rows={2} />}
                    {terminals.error && <ErrorState message={terminals.error} onRetry={terminals.retry} />}
                    {terminals.data && activeTerminals.length === 0 && (
                        <EmptyState icon={ScanFace} title={t('live.noTerminalsTitle')} description={t('live.noTerminals')} />
                    )}
                    <div className={cn('grid gap-3', shownCameras.length > 1 && 'md:grid-cols-2')}>
                        {shownCameras.map((terminal) => (
                            <TerminalCamera key={terminal.id} terminal={terminal} />
                        ))}
                    </div>

                    {latest && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">{t('live.latest')}</h3>
                            <LiveEventRow
                                key={latest.eventId}
                                event={latest}
                                terminal={terminalById.get(latest.terminalId)}
                                large
                                fresh={freshIds.has(latest.eventId)}
                            />
                        </div>
                    )}
                </section>

                <section aria-labelledby="live-feed" className="min-w-0 space-y-3">
                    <h2 id="live-feed" className="font-heading text-lg font-bold">
                        {t('live.feed')}
                    </h2>
                    {events.length === 0 ? (
                        <EmptyState icon={Radio} title={t('live.emptyTitle')} description={t('live.empty')} />
                    ) : (
                        <ol aria-live="polite" className="max-h-[70vh] list-none space-y-2 overflow-y-auto pr-1">
                            {events.map((event) => (
                                <li key={event.eventId}>
                                    <LiveEventRow
                                        event={event}
                                        terminal={terminalById.get(event.terminalId)}
                                        fresh={freshIds.has(event.eventId)}
                                    />
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>
        </div>
    );
}

export function LivePage() {
    const { t } = useTranslation();
    const ids = useId();
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const role = session?.profile.role;
    const ownSchool = role === 'SCHOOL_ADMIN' ? String(session?.profile.schoolId ?? '') : '';

    const schools = useApiQuery<School[]>('/schools');
    const requested = searchParams.get('schoolId') ?? '';
    const schoolId = ownSchool || (/^[1-9]\d*$/.test(requested) ? requested : '');

    return (
        <div className="w-full min-w-0 space-y-5 sm:space-y-6">
            <PageHeader eyebrow={t('nav.groups.attendance')} title={t('live.title')} description={t('live.subtitle')} />

            {!ownSchool && (
                <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                    <Field htmlFor={`${ids}-school`} label={t('common.school')}>
                        <SelectField
                            id={`${ids}-school`}
                            value={schoolId}
                            onValueChange={(value) => setSearchParams(value ? { schoolId: value } : {})}
                            placeholder={t('live.chooseSchool')}
                            options={(schools.data ?? []).map((school) => ({
                                value: String(school.id),
                                label: `${school.name} · ${school.district.name}`,
                            }))}
                            disabled={schools.loading || Boolean(schools.error)}
                        />
                    </Field>
                    {schools.error && <ErrorState message={schools.error} onRetry={schools.retry} />}
                </section>
            )}

            {schoolId ? (
                <LiveBoard key={schoolId} schoolId={schoolId} />
            ) : (
                <EmptyState icon={Radio} title={t('live.chooseSchoolTitle')} description={t('live.chooseSchool')} />
            )}
        </div>
    );
}
