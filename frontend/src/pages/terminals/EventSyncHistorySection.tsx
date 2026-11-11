
import { useState } from "react";
import { History, RefreshCw } from "lucide-react";

import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDateTime } from "@/lib/date";

interface EventRun {
    id: string;
    terminalId: number;
    terminalName: string | null;
    status: "SUCCESS" | "FAILED";
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    cursorBefore: string | null;
    cursorAfter: string | null;
    errorCode: string | null;
}

interface HistoryResponse {
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
    items: EventRun[];
}

export function EventSyncHistorySection() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("ALL");
    const [terminalInput, setTerminalInput] = useState("");
    const [terminalId, setTerminalId] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [filterError, setFilterError] = useState("");

    const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status,
    });

    if (terminalId) params.set("terminalId", terminalId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const { data, loading, error, retry, refreshing } =
        useApiQuery<HistoryResponse>(
            `/terminal-sync-monitoring/history?${params.toString()}`,
        );

    function applyFilters() {
        const id = terminalInput.trim();

        if (
            id &&
            (!/^[1-9]\d*$/.test(id) ||
                !Number.isSafeInteger(Number(id)) ||
                Number(id) > 4294967295)
        ) {
            setFilterError("Terminal ID noto‘g‘ri");
            return;
        }

        if (dateFrom && dateTo && dateFrom > dateTo) {
            setFilterError("Sana oralig‘i noto‘g‘ri");
            return;
        }

        setFilterError("");
        setTerminalId(id);
        setPage(1);
        retry();
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">
                        Davomat eventlarini olish tarixi
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Turniketlardan eventlarni olish urinishlari va natijalari.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={retry}
                    disabled={refreshing}
                >
                    <RefreshCw
                        className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Yangilash
                </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
                <label className="space-y-1 text-sm">
                    <span className="block">Holat</span>
                    <select
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}
                        className="h-9 rounded-md border bg-background px-3"
                    >
                        <option value="ALL">Barchasi</option>
                        <option value="SUCCESS">Muvaffaqiyatli</option>
                        <option value="FAILED">Xatolik</option>
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="block">Terminal ID</span>
                    <input
                        type="number"
                        min="1"
                        value={terminalInput}
                        onChange={(event) =>
                            setTerminalInput(event.target.value)
                        }
                        placeholder="Barchasi"
                        className="h-9 w-32 rounded-md border bg-background px-3"
                    />
                </label>

                <label className="space-y-1 text-sm">
                    <span className="block">Boshlanish sanasi</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                        className="h-9 rounded-md border bg-background px-3"
                    />
                </label>

                <label className="space-y-1 text-sm">
                    <span className="block">Tugash sanasi</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                        className="h-9 rounded-md border bg-background px-3"
                    />
                </label>

                <Button
                    type="button"
                    variant="outline"
                    onClick={applyFilters}
                >
                    Filterlash
                </Button>
            </div>

            {filterError && (
                <p role="alert" className="text-sm text-destructive">
                    {filterError}
                </p>
            )}

            {loading ? (
                <LoadingState rows={5} />
            ) : error || !data ? (
                <ErrorState
                    message={error || "Tarixni olishda xatolik"}
                    onRetry={retry}
                />
            ) : data.items.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Eventlar sinxronlash tarixi topilmadi"
                    description="Tanlangan filterlarga mos yozuv yo‘q."
                />
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full min-w-[1050px] text-left text-sm">
                            <thead className="bg-muted/60">
                                <tr>
                                    {[
                                        "Terminal",
                                        "Boshlangan",
                                        "Yakunlangan",
                                        "Holat",
                                        "Davomiylik",
                                        "Oldingi cursor",
                                        "Yangi cursor",
                                        "Xatolik",
                                    ].map((heading) => (
                                        <th
                                            key={heading}
                                            className="px-3 py-3 font-medium"
                                        >
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {data.items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t hover:bg-muted/30"
                                    >
                                        <td className="px-3 py-3">
                                            <div className="font-medium">
                                                {item.terminalName ?? "Terminal"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                ID: {item.terminalId}
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {formatDateTime(item.startedAt)}
                                        </td>

                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {formatDateTime(item.finishedAt)}
                                        </td>

                                        <td className="px-3 py-3">
                                            <StatusBadge
                                                tone={
                                                    item.status === "SUCCESS"
                                                        ? "success"
                                                        : "danger"
                                                }
                                            >
                                                {item.status === "SUCCESS"
                                                    ? "Muvaffaqiyatli"
                                                    : "Xatolik"}
                                            </StatusBadge>
                                        </td>

                                        <td className="px-3 py-3 tabular-nums">
                                            {(item.durationMs / 1000).toFixed(1)} s
                                        </td>

                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {formatDateTime(item.cursorBefore)}
                                        </td>

                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {formatDateTime(item.cursorAfter)}
                                        </td>

                                        <td className="px-3 py-3 text-destructive">
                                            {item.errorCode ?? "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        page={data.pagination.page}
                        totalPages={data.pagination.totalPages}
                        total={data.pagination.totalItems}
                        pageSize={data.pagination.limit}
                        shownCount={data.items.length}
                        onPageChange={setPage}
                    />
                </>
            )}
        </section>
    );
}
