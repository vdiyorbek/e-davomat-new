
import { useEffect, useRef } from "react";
import { History, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDateTime } from "@/lib/date";

interface SyncHistoryItem {
    id: string;
    status: "SUCCESS" | "FAILED";
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    cursorBefore: string | null;
    cursorAfter: string | null;
    errorCode: string | null;
}

interface SyncHistoryResponse {
    success: boolean;
    terminalId: number;
    total: number;
    items: SyncHistoryItem[];
}

export function TerminalSyncHistory({
    terminalId,
}: {
    terminalId: number;
}) {
    const query = useApiQuery<SyncHistoryResponse>(
        `/terminal-sync-monitoring/${terminalId}/history`,
    );

    const retryRef = useRef(query.retry);
    retryRef.current = query.retry;

    useEffect(() => {
        const interval = window.setInterval(() => {
            retryRef.current();
        }, 30_000);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <section className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                    <History aria-hidden="true" className="size-4" />
                    Sinxronlash tarixi
                </h3>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={query.loading}
                    onClick={query.retry}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Yangilash
                </Button>
            </div>

            {query.loading && (
                <p className="text-sm text-muted-foreground">
                    Tarix yuklanmoqda...
                </p>
            )}

            {query.error && (
                <p role="alert" className="text-sm text-destructive">
                    {query.error}
                </p>
            )}

            {query.data && (
                <>
                    <p className="text-xs text-muted-foreground">
                        Jami yozuvlar:{" "}
                        {query.data.total.toLocaleString("uz-UZ")}
                    </p>

                    {query.data.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Hozircha sinxronlash tarixi mavjud emas.
                        </p>
                    ) : (
                        <div className="max-h-80 overflow-auto rounded-lg border">
                            <table className="w-full min-w-[650px] text-left text-xs">
                                <thead className="sticky top-0 bg-muted">
                                    <tr>
                                        <th className="p-2">Boshlangan</th>
                                        <th className="p-2">Natija</th>
                                        <th className="p-2">Davomiylik</th>
                                        <th className="p-2">Cursor</th>
                                        <th className="p-2">Xatolik</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {query.data.items.map((run) => (
                                        <tr key={run.id} className="border-t">
                                            <td className="whitespace-nowrap p-2">
                                                {formatDateTime(run.startedAt, "—")}
                                            </td>

                                            <td className="p-2">
                                                <span
                                                    className={
                                                        run.status === "SUCCESS"
                                                            ? "font-medium text-emerald-600"
                                                            : "font-medium text-destructive"
                                                    }
                                                >
                                                    {run.status === "SUCCESS"
                                                        ? "Muvaffaqiyatli"
                                                        : "Xatolik"}
                                                </span>
                                            </td>

                                            <td className="p-2 tabular-nums">
                                                {(run.durationMs / 1000).toFixed(2)} s
                                            </td>

                                            <td className="whitespace-nowrap p-2">
                                                {formatDateTime(run.cursorAfter, "—")}
                                            </td>

                                            <td className="p-2">
                                                {run.errorCode ?? "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Oxirgi 20 ta yozuv ko‘rsatiladi.
                        Ma’lumotlar har 30 soniyada yangilanadi.
                    </p>
                </>
            )}
        </section>
    );
}
