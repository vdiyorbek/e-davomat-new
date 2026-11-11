
import { useEffect, useRef } from "react";
import { Activity, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDateTime } from "@/lib/date";

interface SyncMonitoringResponse {
    terminalId: number;
    queueName: string;
    state: string;
    attemptsMade: number;
    maxAttempts: number;
    jobId: string | null;
    lastFailedReason: string | null;
    queue: {
        waiting: number;
        active: number;
        delayed: number;
        failed: number;
    };
    sync: {
        syncStartAt: string | null;
        eventsSyncedUntil: string | null;
        lastSuccessfulSyncAt: string | null;
    };
    checkedAt: string;
}

interface Props {
    terminalId: number;
}

const stateLabels: Record<string, string> = {
    active: "Bajarilmoqda",
    waiting: "Navbatda",
    delayed: "Kutishda",
    failed: "Xatolik",
    completed: "Yakunlangan",
    waitingChildren: "Bog‘liq vazifalarni kutmoqda",
    idle: "Faol vazifa yo‘q",
};

export function TerminalSyncMonitoring({
    terminalId,
}: Props) {
    const query = useApiQuery<SyncMonitoringResponse>(
        `/terminal-sync-monitoring/${terminalId}`,
    );

    const refreshRef = useRef(query.retry);
    refreshRef.current = query.retry;

    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshRef.current();
        }, 15_000);

        return () => window.clearInterval(interval);
    }, []);

    const data = query.data;

    return (
        <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                    <Activity aria-hidden="true" className="size-4" />
                    Sinxronlash diagnostikasi
                </h3>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={query.retry}
                    disabled={query.loading}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Yangilash
                </Button>
            </div>

            {query.loading && (
                <p className="text-sm text-muted-foreground">
                    Navbat holati yuklanmoqda...
                </p>
            )}

            {query.error && (
                <p role="alert" className="text-sm text-destructive">
                    {query.error}
                </p>
            )}

            {data && (
                <>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Joriy holat
                            </dt>
                            <dd className="font-medium">
                                {stateLabels[data.state] ?? data.state}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Urinishlar
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {data.attemptsMade} / {data.maxAttempts || "—"}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Navbatda
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {data.queue.waiting}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Bajarilmoqda
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {data.queue.active}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Kechiktirilgan
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {data.queue.delayed}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Xatoli vazifalar
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {data.queue.failed}
                            </dd>
                        </div>
                    </dl>

                    <div className="space-y-2 border-t pt-3 text-sm">
                        <div>
                            <div className="text-xs text-muted-foreground">
                                Eventlar sinxronlangan vaqtgacha
                            </div>
                            <div>
                                {formatDateTime(
                                    data.sync.eventsSyncedUntil,
                                    "—",
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-muted-foreground">
                                Oxirgi muvaffaqiyatli sinxronlash
                            </div>
                            <div>
                                {formatDateTime(
                                    data.sync.lastSuccessfulSyncAt,
                                    "—",
                                )}
                            </div>
                        </div>
                    </div>

                    {data.lastFailedReason && (
                        <p
                            role="alert"
                            className="break-words text-xs text-destructive"
                        >
                            Vazifa xatosi: {data.lastFailedReason}
                        </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Ma’lumotlar har 15 soniyada yangilanadi.
                        Navbat sonlari barcha terminallarga tegishli.
                    </p>
                </>
            )}
        </section>
    );
}
