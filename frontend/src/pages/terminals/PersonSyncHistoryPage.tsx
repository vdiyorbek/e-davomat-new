
import { useState } from "react";
import { History, RefreshCw, Eye, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
    LoadingState,
    ErrorState,
    EmptyState,
} from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDateTime } from "@/lib/date";

type Counts = Record<string, number>;

interface Batch {
    id: string;
    requestedByUserId: number | null;
    type: "STUDENT" | "TEACHER" | "BOTH";
    status: string;
    terminalCount: number;
    totalItems: number;
    queuedItems: number;
    createdAt: string;
    finishedAt: string | null;
    counts: Counts;
}

interface PaginationInfo {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}

interface HistoryResponse {
    batches: Batch[];
    pagination: PaginationInfo;
}

interface HistoryItem {
    id: string;
    terminalId: number;
    terminalName: string | null;
    personId: number;
    jobId: string | null;
    status: string;
    attempts: number;
    errorCode: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
}

interface DetailResponse {
    batch: Batch;
    counts: Counts;
    pagination: PaginationInfo;
    items: HistoryItem[];
}

const batchLabels: Record<string, string> = {
    QUEUING: "Navbatga olinmoqda",
    QUEUED: "Navbatda",
    RUNNING: "Jarayonda",
    COMPLETED: "Yakunlangan",
    PARTIAL: "Qisman yakunlangan",
    FAILED: "Xatolik",
};

const itemLabels: Record<string, string> = {
    PENDING: "Kutilmoqda",
    QUEUED: "Navbatda",
    RUNNING: "Jarayonda",
    SUCCESS: "Muvaffaqiyatli",
    SKIPPED: "O‘tkazib yuborilgan",
    FAILED: "Xatolik",
    UNCERTAIN: "Tekshirish kerak",
};

function statusTone(status: string) {
    if (status === "SUCCESS" || status === "COMPLETED")
        return "success" as const;

    if (status === "FAILED")
        return "danger" as const;

    if (status === "UNCERTAIN" || status === "PARTIAL")
        return "warning" as const;

    if (status === "RUNNING" || status === "QUEUED")
        return "info" as const;

    return "neutral" as const;
}

function finishedCount(counts: Counts): number {
    return (
        (counts.SUCCESS ?? 0) +
        (counts.SKIPPED ?? 0) +
        (counts.FAILED ?? 0) +
        (counts.UNCERTAIN ?? 0)
    );
}

function SyncProgress({
    counts,
    total,
}: {
    counts: Counts;
    total: number;
}) {
    const finished = finishedCount(counts);
    const percentage =
        total > 0
            ? Math.min(100, Math.round((finished / total) * 100))
            : 100;

    return (
        <div className="min-w-32 space-y-1">
            <div className="flex justify-between text-xs">
                <span>{finished} / {total}</span>
                <span>{percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function BatchDetails({
    batchId,
    onBack,
}: {
    batchId: string;
    onBack: () => void;
}) {
    const [page, setPage] = useState(1);

    const { data, loading, error, retry } =
        useApiQuery<DetailResponse>(
            `/person-sync-queue/history/${batchId}?page=${page}&limit=20`,
        );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    <ArrowLeft className="size-4" />
                    Orqaga
                </Button>

                <Button type="button" variant="outline" onClick={retry}>
                    <RefreshCw className="size-4" />
                    Yangilash
                </Button>
            </div>

            <h2 className="text-xl font-semibold">
                Topshiriq #{batchId}
            </h2>

            {loading ? (
                <LoadingState rows={5} />
            ) : error || !data ? (
                <ErrorState
                    message={error || "Ma’lumot yuklanmadi"}
                    onRetry={retry}
                />
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-4">
                        {[
                            ["Muvaffaqiyatli", data.counts.SUCCESS ?? 0],
                            ["O‘tkazilgan", data.counts.SKIPPED ?? 0],
                            ["Xatolik", data.counts.FAILED ?? 0],
                            ["Noaniq", data.counts.UNCERTAIN ?? 0],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-xl border p-4">
                                <p className="text-xs text-muted-foreground">
                                    {label}
                                </p>
                                <p className="mt-1 text-2xl font-semibold">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-muted/60">
                                <tr>
                                    {[
                                        "Terminal",
                                        "Shaxs ID",
                                        "Holat",
                                        "Urinish",
                                        "Xatolik",
                                        "Boshlangan",
                                        "Yakunlangan",
                                    ].map((heading) => (
                                        <th key={heading} className="px-3 py-3">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((item) => (
                                    <tr key={item.id} className="border-t">
                                        <td className="px-3 py-3">
                                            <div>{item.terminalName ?? "Terminal"}</div>
                                            <div className="text-xs text-muted-foreground">
                                                #{item.terminalId}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            {item.personId}
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {itemLabels[item.status] ?? item.status}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-3 py-3">{item.attempts}</td>
                                        <td className="px-3 py-3 text-xs">
                                            {item.errorCode ?? "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {formatDateTime(item.startedAt, "—")}
                                        </td>
                                        <td className="px-3 py-3">
                                            {formatDateTime(item.finishedAt, "—")}
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
        </div>
    );
}

export function PersonSyncHistoryPage() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("ALL");
    const [terminalInput, setTerminalInput] = useState("");
    const [terminalId, setTerminalId] = useState("");
    const [selectedBatchId, setSelectedBatchId] =
        useState<string | null>(null);

    const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status,
    });

    if (terminalId) {
        params.set("terminalId", terminalId);
    }

    const { data, loading, error, retry } =
        useApiQuery<HistoryResponse>(
            `/person-sync-queue/history?${params.toString()}`,
        );

    if (selectedBatchId) {
        return (
            <BatchDetails
                key={selectedBatchId}
                batchId={selectedBatchId}
                onBack={() => setSelectedBatchId(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="E-Davomat / Hikvision"
                title="Shaxslarni sinxronlash tarixi"
                description="Terminallarga yuborilgan o‘quvchi va o‘qituvchilar bo‘yicha topshiriqlar, bajarilish jarayoni va natijalar."
                actions={
                    <Button type="button" variant="outline" onClick={retry}>
                        <RefreshCw className="size-4" />
                        Yangilash
                    </Button>
                }
            />

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
                        {Object.entries(batchLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="block">Terminal ID</span>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={terminalInput}
                        onChange={(event) => setTerminalInput(event.target.value)}
                        className="h-9 w-36 rounded-md border bg-background px-3"
                        placeholder="Barchasi"
                    />
                </label>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        const value = terminalInput.trim();
                        if (
                            value &&
                            (!/^[1-9]\d*$/.test(value) ||
                                !Number.isSafeInteger(Number(value)) ||
                                Number(value) > 4294967295)
                        ) return;

                        setTerminalId(value);
                        setPage(1);
                    }}
                >
                    Filterlash
                </Button>
            </div>

            {loading ? (
                <LoadingState rows={5} />
            ) : error || !data ? (
                <ErrorState
                    message={error || "Tarix yuklanmadi"}
                    onRetry={retry}
                />
            ) : data.batches.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Topshiriqlar topilmadi"
                    description="Yangi sinxronlash topshiriqlari shu yerda paydo bo‘ladi."
                />
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full min-w-[950px] text-left text-sm">
                            <thead className="bg-muted/60">
                                <tr>
                                    {[
                                        "Topshiriq",
                                        "Yuborilgan vaqt",
                                        "Shaxslar",
                                        "Terminallar",
                                        "Holat",
                                        "Bajarilish",
                                        "Amallar",
                                    ].map((heading) => (
                                        <th key={heading} className="px-3 py-3">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.batches.map((batch) => (
                                    <tr key={batch.id} className="border-t hover:bg-muted/30">
                                        <td className="px-3 py-3 font-medium">
                                            #{batch.id}
                                        </td>
                                        <td className="px-3 py-3">
                                            {formatDateTime(batch.createdAt, "—")}
                                        </td>
                                        <td className="px-3 py-3">
                                            {batch.type === "BOTH"
                                                ? "O‘quvchi va o‘qituvchi"
                                                : batch.type === "STUDENT"
                                                    ? "O‘quvchilar"
                                                    : "O‘qituvchilar"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {batch.terminalCount}
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge tone={statusTone(batch.status)}>
                                                {batchLabels[batch.status] ?? batch.status}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-3 py-3">
                                            <SyncProgress
                                                counts={batch.counts}
                                                total={batch.totalItems}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedBatchId(batch.id)}
                                            >
                                                <Eye className="size-4" />
                                                Tafsilotlar
                                            </Button>
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
                        shownCount={data.batches.length}
                        onPageChange={setPage}
                    />
                </>
            )}
        </div>
    );
}
