
import { useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    RefreshCw,
    Server,
    Eye
} from "lucide-react";
import { TerminalMonitoringDialog } from "@/components/terminals/TerminalMonitoringDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PersonSyncRecheckButton } from
    "@/components/terminals/PersonSyncRecheckButton";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";

type SyncStatus =
    | "SUCCESS"
    | "TIMEOUT"
    | "ERROR"
    | "NOT_CHECKED";

type StatusFilter = SyncStatus | "ALL";

interface TerminalItem {
    terminalId: number;
    terminalName: string;
    schoolId: number;
    status: SyncStatus;
    databaseTeachers: number | null;
    terminalUsers: number | null;
    missingCount: number | null;
    invalidPnfl: number | null;
    durationMs: number | null;
    errorCode: string | null;
    checkedAt: string | null;
    jobId: string | null;
}

interface MonitoringResponse {
    generatedAt: string;
    summary: {
        totalTerminals: number;
        success: number;
        timeout: number;
        error: number;
        notChecked: number;
        terminalsWithMissingTeachers: number;
        missingTeachersTotal: number;
    };
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
    filters: {
        status: StatusFilter;
        schoolId: number | null;
    };
    terminals: TerminalItem[];
}

const statusLabels: Record<SyncStatus, string> = {
    SUCCESS: "Muvaffaqiyatli",
    TIMEOUT: "Timeout",
    ERROR: "Xatolik",
    NOT_CHECKED: "Tekshirilmagan",
};

const statusTones = {
    SUCCESS: "success",
    TIMEOUT: "danger",
    ERROR: "warning",
    NOT_CHECKED: "neutral",
} as const;

function formatCheckDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("uz-UZ", {
        timeZone: "Asia/Tashkent",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function numberOrDash(value: number | null) {
    return value === null
        ? "—"
        : value.toLocaleString("uz-UZ");
}

function SummaryCard({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: number;
    icon: typeof Server;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {title}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {value.toLocaleString("uz-UZ")}
                    </p>
                </div>
                <Icon
                    aria-hidden="true"
                    className="size-6 text-muted-foreground"
                />
            </CardContent>
        </Card>
    );
}

export function PersonSyncMonitoringPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [status, setStatus] =
        useState<StatusFilter>("ALL");
    const [schoolInput, setSchoolInput] = useState("");
    const [schoolId, setSchoolId] = useState<number | null>(
        null,
    );
    const [selectedTerminalId, setSelectedTerminalId] =
        useState<number | null>(null);

    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
    });

    if (schoolId !== null) {
        params.set("schoolId", String(schoolId));
    }

    const path =
        `/person-sync-queue/monitoring?${params.toString()}`;

    const { data, loading, error, retry } =
        useApiQuery<MonitoringResponse>(path);

    function applySchoolFilter() {
        const trimmed = schoolInput.trim();

        if (!trimmed) {
            setSchoolId(null);
            setPage(1);
            return;
        }

        const parsed = Number(trimmed);

        if (
            !Number.isSafeInteger(parsed) ||
            parsed <= 0
        ) {
            return;
        }

        setSchoolId(parsed);
        setPage(1);
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="E-Davomat / Hikvision"
                title="Terminallar sinxronlash monitoringi"
                description="Barcha faol terminallarning oxirgi diagnostika natijalari."
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={retry}
                        disabled={loading}
                    >
                        <RefreshCw
                            aria-hidden="true"
                            className={loading ? "animate-spin" : ""}
                        />
                        Yangilash
                    </Button>
                }
            />

            {data && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        title="Jami terminallar"
                        value={data.summary.totalTerminals}
                        icon={Server}
                    />
                    <SummaryCard
                        title="Muvaffaqiyatli"
                        value={data.summary.success}
                        icon={CheckCircle2}
                    />
                    <SummaryCard
                        title="Timeout"
                        value={data.summary.timeout}
                        icon={Clock3}
                    />
                    <SummaryCard
                        title="Xatolik"
                        value={data.summary.error}
                        icon={AlertTriangle}
                    />
                </div>
            )}

            {data && (
                <p className="text-sm text-muted-foreground">
                    Tekshirilmagan: {data.summary.notChecked}
                    {" · "}
                    O‘qituvchi yetishmayotgan terminallar:{" "}
                    {data.summary.terminalsWithMissingTeachers}
                    {" · "}
                    Yetishmayotgan o‘qituvchilar yozuvlari:{" "}
                    {data.summary.missingTeachersTotal}
                </p>
            )}

            <Card>
                <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex min-w-40 flex-col gap-1 text-sm">
                            Holat
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3"
                                value={status}
                                onChange={(event) => {
                                    setStatus(
                                        event.target.value as StatusFilter,
                                    );
                                    setPage(1);
                                }}
                            >
                                <option value="ALL">Barchasi</option>
                                <option value="SUCCESS">SUCCESS</option>
                                <option value="TIMEOUT">TIMEOUT</option>
                                <option value="ERROR">ERROR</option>
                                <option value="NOT_CHECKED">
                                    NOT_CHECKED
                                </option>
                            </select>
                        </label>

                        <label className="flex min-w-40 flex-col gap-1 text-sm">
                            Maktab ID
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={schoolInput}
                                onChange={(event) =>
                                    setSchoolInput(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        applySchoolFilter();
                                    }
                                }}
                                placeholder="Barcha maktablar"
                                className="h-10 rounded-md border border-input bg-background px-3"
                            />
                        </label>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={applySchoolFilter}
                        >
                            Filterlash
                        </Button>

                        <label className="flex flex-col gap-1 text-sm">
                            Sahifa hajmi
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3"
                                value={limit}
                                onChange={(event) => {
                                    setLimit(Number(event.target.value));
                                    setPage(1);
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </label>
                    </div>

                    {loading ? (
                        <LoadingState rows={5} />
                    ) : error || !data ? (
                        <ErrorState
                            message={error || "Ma’lumot olinmadi"}
                            onRetry={retry}
                        />
                    ) : data.terminals.length === 0 ? (
                        <EmptyState
                            icon={Server}
                            title="Terminal topilmadi"
                            description="Tanlangan filterlarga mos terminal yo‘q."
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead className="bg-muted/60 text-left">
                                        <tr>
                                            {[
                                                "Terminal",
                                                "Maktab",
                                                "Holat",
                                                "O‘qituvchilar",
                                                "Terminalda",
                                                "Yetishmaydi",
                                                "Davomiylik",
                                                "Oxirgi tekshiruv",
                                                "Amallar"
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
                                        {data.terminals.map((item) => (
                                            <tr
                                                key={item.terminalId}
                                                className="border-t hover:bg-muted/30"
                                            >
                                                <td className="px-3 py-3">
                                                    <div className="font-medium">
                                                        {item.terminalName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        ID: {item.terminalId}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3">
                                                    {item.schoolId}
                                                </td>

                                                <td className="px-3 py-3">
                                                    <StatusBadge
                                                        tone={statusTones[item.status]}
                                                    >
                                                        {statusLabels[item.status]}
                                                    </StatusBadge>
                                                    {item.errorCode && (
                                                        <p className="mt-1 text-xs text-destructive">
                                                            {item.errorCode}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-3 py-3 tabular-nums">
                                                    {numberOrDash(item.databaseTeachers)}
                                                </td>

                                                <td className="px-3 py-3 tabular-nums">
                                                    {numberOrDash(item.terminalUsers)}
                                                </td>

                                                <td className="px-3 py-3 tabular-nums">
                                                    {numberOrDash(item.missingCount)}
                                                </td>

                                                <td className="px-3 py-3 tabular-nums">
                                                    {item.durationMs === null
                                                        ? "—"
                                                        : `${(item.durationMs / 1000).toFixed(1)} s`}
                                                </td>

                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {formatCheckDate(item.checkedAt)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col items-start gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                setSelectedTerminalId(item.terminalId)
                                                            }
                                                        >
                                                            <Eye aria-hidden="true" />
                                                            Tafsilotlar
                                                        </Button>

                                                        <PersonSyncRecheckButton
                                                            terminalId={item.terminalId}
                                                            onFinished={retry}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination
                                page={data.pagination.page}
                                totalPages={Math.max(
                                    data.pagination.totalPages,
                                    1,
                                )}
                                total={data.pagination.totalItems}
                                pageSize={data.pagination.limit}
                                shownCount={data.terminals.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
            <TerminalMonitoringDialog
                terminalId={selectedTerminalId}
                onClose={() => setSelectedTerminalId(null)}
            />
        </div>
    );
}
