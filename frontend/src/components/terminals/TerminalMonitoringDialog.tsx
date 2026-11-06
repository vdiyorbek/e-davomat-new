
import { useState } from "react";

import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
    ErrorState,
    LoadingState,
} from "@/components/common/states";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { useApiQuery } from "@/hooks/useApiQuery";

type CheckStatus = "SUCCESS" | "TIMEOUT" | "ERROR";

interface HistoryItem {
    id: string;
    status: CheckStatus;
    databaseTeachers: number | null;
    terminalUsers: number | null;
    missingCount: number | null;
    invalidPnfl: number | null;
    durationMs: number;
    errorCode: string | null;
    jobId: string | null;
    checkedAt: string;
}

interface HistoryResponse {
    terminal: {
        id: number;
        name: string;
        schoolId: number;
        isActive: boolean;
    };
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
    checks: HistoryItem[];
}

function formatTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("uz-UZ", {
        timeZone: "Asia/Tashkent",
        dateStyle: "short",
        timeStyle: "medium",
    }).format(date);
}

function Value({
    value,
}: {
    value: number | null;
}) {
    return (
        <span className="tabular-nums">
            {value === null ? "—" : value}
        </span>
    );
}

function HistoryContent({
    terminalId,
}: {
    terminalId: number;
}) {
    const [page, setPage] = useState(1);

    const path =
        `/person-sync-queue/monitoring/terminals/` +
        `${terminalId}/history?page=${page}&limit=10`;

    const { data, loading, error, retry } =
        useApiQuery<HistoryResponse>(path);

    if (loading) {
        return <LoadingState rows={4} />;
    }

    if (error || !data) {
        return (
            <ErrorState
                message={error || "Tarix yuklanmadi"}
                onRetry={retry}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
                <p>Maktab ID: {data.terminal.schoolId}</p>
                <p>
                    Terminal:{" "}
                    {data.terminal.isActive
                        ? "Faol"
                        : "Nofaol"}
                </p>
                <p>
                    Tekshiruvlar soni:{" "}
                    {data.pagination.totalItems}
                </p>
            </div>

            {data.checks.length === 0 ? (
                <p className="rounded-lg border p-5 text-center text-sm text-muted-foreground">
                    Ushbu terminal uchun MySQL'da hali
                    diagnostika tarixi mavjud emas.
                </p>
            ) : (
                <div className="space-y-3">
                    {data.checks.map((check) => (
                        <div
                            key={check.id}
                            className="space-y-3 rounded-lg border p-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusBadge
                                    tone={
                                        check.status === "SUCCESS"
                                            ? "success"
                                            : check.status === "TIMEOUT"
                                                ? "danger"
                                                : "warning"
                                    }
                                >
                                    {check.status}
                                </StatusBadge>

                                <span className="text-xs text-muted-foreground">
                                    {formatTime(check.checkedAt)}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">
                                        O‘qituvchilar
                                    </p>
                                    <Value value={check.databaseTeachers} />
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Terminalda
                                    </p>
                                    <Value value={check.terminalUsers} />
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Yetishmaydi
                                    </p>
                                    <Value value={check.missingCount} />
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Davomiylik
                                    </p>
                                    <span>
                                        {(check.durationMs / 1000).toFixed(1)}
                                        {" soniya"}
                                    </span>
                                </div>
                            </div>

                            {check.errorCode && (
                                <p className="text-sm text-destructive">
                                    Xatolik: {check.errorCode}
                                </p>
                            )}

                            {check.jobId && (
                                <p className="break-all text-xs text-muted-foreground">
                                    Job ID: {check.jobId}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Pagination
                page={data.pagination.page}
                totalPages={Math.max(
                    1,
                    data.pagination.totalPages,
                )}
                total={data.pagination.totalItems}
                pageSize={data.pagination.limit}
                shownCount={data.checks.length}
                onPageChange={setPage}
            />
        </div>
    );
}

export function TerminalMonitoringDialog({
    terminalId,
    onClose,
}: {
    terminalId: number | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={terminalId !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Terminal diagnostikasi
                        {terminalId !== null && ` · #${terminalId}`}
                    </DialogTitle>
                    <DialogDescription>
                        Terminalning oldingi tekshiruvlari va
                        oxirgi qayd etilgan natijalari.
                    </DialogDescription>
                </DialogHeader>

                {terminalId !== null && (
                    <HistoryContent
                        key={terminalId}
                        terminalId={terminalId}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
