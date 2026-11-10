
import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { authorizedPost } from "@/lib/auth-session";
import { formatDateTime } from "@/lib/date";

interface PhotoStats {
    terminalId: number;
    total: number;
    pending: number;
    downloaded: number;
    failed: number;
    missing: number;
}

interface StatsResponse {
    success: boolean;
    terminals: PhotoStats[];
}

interface PhotoIssue {
    eventId: string;
    eventAt: string;
    status: "FAILED" | "MISSING";
    attempts: number;
    lastAttemptAt: string | null;
    lastError: string | null;
}

interface IssuesResponse {
    success: boolean;
    terminalId: number;
    total: number;
    items: PhotoIssue[];
}

interface RetryResponse {
    success: boolean;
    terminalId: number;
    reset: number;
}

interface Props {
    terminalId: number;
    canManage: boolean;
}

export function TerminalPhotoStats({
    terminalId,
    canManage,
}: Props) {
    const statsQuery = useApiQuery<StatsResponse>(
        "/attendance-events/photos/stats",
    );

    const issuesQuery = useApiQuery<IssuesResponse>(
        `/attendance-events/photos/${terminalId}/issues?limit=50`,
    );

    const [busy, setBusy] = useState(false);
    const [busyEventId, setBusyEventId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [actionError, setActionError] = useState("");

    // So‘nggi retry funksiyalarini intervalga ulaymiz.
    const refreshRef = useRef<() => void>(() => { });

    refreshRef.current = () => {
        statsQuery.retry();
        issuesQuery.retry();
    };

    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshRef.current();
        }, 30_000);

        return () => window.clearInterval(interval);
    }, []);

    const stats = statsQuery.data?.terminals.find(
        (item) => item.terminalId === terminalId,
    );

    const issues = issuesQuery.data;

    const format = (value: number) =>
        value.toLocaleString("uz-UZ");

    function refresh() {
        refreshRef.current();
    }

    async function retryMissing() {
        if (!canManage || busy) return;

        setBusy(true);
        setMessage("");
        setActionError("");

        try {
            const result = await authorizedPost<RetryResponse>(
                `/attendance-events/photos/${terminalId}/retry-missing`,
                {},
            );

            setMessage(
                `${format(result.reset)} ta rasm qayta tekshirishga tayyorlandi.`,
            );

            refresh();
        } catch (caught: unknown) {
            setActionError(
                caught instanceof Error
                    ? caught.message
                    : "Qayta tekshirishda xatolik yuz berdi",
            );
        } finally {
            setBusy(false);
        }
    }

    async function retrySingle(eventId: string) {
        if (!canManage || busyEventId !== null) return;

        setBusyEventId(eventId);
        setMessage("");
        setActionError("");

        try {
            await authorizedPost(
                `/attendance-events/photos/${terminalId}/events/${eventId}/retry`,
                {},
            );

            setMessage(
                `Event #${eventId} qayta yuklashga tayyorlandi.`,
            );

            refresh();
        } catch (caught: unknown) {
            setActionError(
                caught instanceof Error
                    ? caught.message
                    : "Rasmni qayta tekshirishda xatolik",
            );
        } finally {
            setBusyEventId(null);
        }
    }


    const percentage =
        stats && stats.total > 0
            ? (stats.downloaded / stats.total) * 100
            : 0;

    return (
        <section className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                        <Camera aria-hidden="true" className="size-4" />
                        Davomat rasmlari
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Avtomatik yangilanish: 30 soniya
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={statsQuery.loading || issuesQuery.loading}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Yangilash
                </Button>
            </div>

            {statsQuery.loading && !stats && (
                <p className="text-sm text-muted-foreground">
                    Statistika yuklanmoqda...
                </p>
            )}

            {statsQuery.error && (
                <p role="alert" className="text-sm text-destructive">
                    {statsQuery.error}
                </p>
            )}

            {stats && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <StatBox label="Yuklangan" value={stats.downloaded} />
                        <StatBox label="Navbatda" value={stats.pending} />
                        <StatBox label="Xatolik" value={stats.failed} />
                        <StatBox label="Mavjud emas" value={stats.missing} />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Yuklangan rasmlar</span>
                            <span>{Math.round(percentage)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Jami: {format(stats.total)} ta event
                        </p>
                    </div>

                    {canManage && stats.missing > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={busy}
                            onClick={() => void retryMissing()}
                        >
                            <RefreshCw aria-hidden="true" className="size-4" />
                            {busy
                                ? "Tayyorlanmoqda..."
                                : "Mavjud bo‘lmagan rasmlarni qayta tekshirish"}
                        </Button>
                    )}
                </>
            )}

            {message && (
                <p role="status" className="text-sm text-emerald-600">
                    {message}
                </p>
            )}

            {actionError && (
                <p role="alert" className="text-sm text-destructive">
                    {actionError}
                </p>
            )}

            <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">
                        Yuklanmagan rasmlar
                    </h4>
                    {issues && (
                        <span className="text-xs text-muted-foreground">
                            Jami: {format(issues.total)}
                        </span>
                    )}
                </div>

                {issuesQuery.loading && (
                    <p className="text-xs text-muted-foreground">
                        Eventlar yuklanmoqda...
                    </p>
                )}

                {issuesQuery.error && (
                    <p role="alert" className="text-xs text-destructive">
                        {issuesQuery.error}
                    </p>
                )}

                {issues && issues.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        FAILED yoki MISSING holatidagi eventlar yo‘q.
                    </p>
                )}

                {issues && issues.items.length > 0 && (
                    <div className="max-h-72 overflow-auto rounded-lg border">
                        <table className="w-full min-w-[500px] text-left text-xs">
                            <thead className="sticky top-0 bg-muted">
                                <tr>
                                    <th className="p-2">Event ID</th>
                                    <th className="p-2">Sana</th>
                                    <th className="p-2">Holat</th>
                                    <th className="p-2">Urinish</th>
                                    <th className="p-2">Oxirgi urinish</th>
                                    <th className="p-2">Xatolik sababi</th>
                                    <th className="p-2 text-right">Amallar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.items.map((item) => (
                                    <tr key={item.eventId} className="border-t">
                                        <td className="p-2 font-mono">
                                            {item.eventId}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {formatDateTime(item.eventAt, "—")}
                                        </td>
                                        <td
                                            className="max-w-[280px] break-words p-2 text-muted-foreground"
                                            title={item.lastError ?? undefined}
                                        >
                                            {item.lastError ?? "Sababi qayd etilmagan"}
                                        </td>
                                        <td className="p-2">
                                            <span
                                                className={
                                                    item.status === "FAILED"
                                                        ? "text-destructive"
                                                        : "text-muted-foreground"
                                                }
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="p-2 tabular-nums">
                                            {item.attempts}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {formatDateTime(item.lastAttemptAt, "—")}
                                        </td>

                                        <td className="p-2 text-right">
                                            {canManage && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busyEventId !== null || busy}
                                                    onClick={() => void retrySingle(item.eventId)}
                                                >
                                                    <RefreshCw
                                                        aria-hidden="true"
                                                        className="size-3.5"
                                                    />
                                                    {busyEventId === item.eventId
                                                        ? "Yuborilmoqda..."
                                                        : "Qayta urinish"}
                                                </Button>
                                            )}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {issues && issues.total > issues.items.length && (
                    <p className="text-xs text-muted-foreground">
                        Oxirgi {issues.items.length} ta event ko‘rsatilmoqda.
                    </p>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Qayta tekshirish rasmlarni darhol yuklamaydi.
                Ular keyingi foto sinxronlash navbatiga tayyorlanadi.
            </p>
        </section>
    );
}

function StatBox({
    label,
    value,
}: {
    label: string;
    value: number;
}) {
    return (
        <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
                {value.toLocaleString("uz-UZ")}
            </div>
        </div>
    );
}
