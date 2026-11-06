
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authorizedGet, authorizedPost } from "@/lib/auth-session";

interface EnqueueResponse {
    terminalId: number;
    queued: boolean;
    jobId?: string;
    reason?: string;
}

interface JobResponse {
    jobId: string;
    terminalId: number;
    state: string;
    error: string | null;
    result: {
        skipped?: boolean;
        missingCount?: number;
        databaseTeachers?: number;
        terminalUsers?: number;
        invalidPnfl?: number;
    } | null;
}

type DisplayState =
    | "idle"
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "stopped";

const POLL_INTERVAL_MS = 3000;
const MAX_WATCH_MS = 120000;

export function PersonSyncRecheckButton({
    terminalId,
    onFinished,
}: {
    terminalId: number;
    onFinished: () => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [state, setState] = useState<DisplayState>("idle");
    const [message, setMessage] = useState("");

    const submittingRef = useRef(false);
    const onFinishedRef = useRef(onFinished);

    // Parent qayta render bo‘lganda polling
    // tasodifan boshidan boshlanmasligi uchun.
    useEffect(() => {
        onFinishedRef.current = onFinished;
    }, [onFinished]);

    useEffect(() => {
        if (!jobId) return;

        const controller = new AbortController();
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const startedAt = Date.now();

        const scheduleNext = () => {
            if (stopped) return;
            timer = setTimeout(() => {
                void poll();
            }, POLL_INTERVAL_MS);
        };

        async function poll() {
            if (stopped) return;

            if (Date.now() - startedAt >= MAX_WATCH_MS) {
                setState("stopped");
                setMessage(
                    "Kuzatish muddati tugadi. Vazifa Redis'da " +
                    "hali ishlayotgan bo‘lishi mumkin.",
                );
                return;
            }

            try {
                const data = await authorizedGet<JobResponse>(
                    `/person-sync-queue/jobs/${encodeURIComponent(jobId!)}`,
                    controller.signal,
                );

                if (stopped) return;

                if (data.terminalId !== terminalId) {
                    setState("failed");
                    setMessage("Vazifa boshqa terminalga tegishli.");
                    return;
                }

                if (data.state === "completed") {
                    if (data.result?.skipped) {
                        setState("failed");
                        setMessage("Terminal tekshiruvi o'tkazib yuborilgan.");
                    } else {
                        setState("completed");
                        setMessage(
                            `Tekshiruv yakunlandi. ` +
                            `Yetishmayotgan o‘qituvchilar: ` +
                            `${data.result?.missingCount ?? "noma’lum"}.`,
                        );
                    }

                    onFinishedRef.current();
                    return;
                }

                if (data.state === "failed") {
                    setState("failed");
                    setMessage(data.error ?? "Tekshiruvda xatolik yuz berdi.");
                    onFinishedRef.current();
                    return;
                }

                if (data.state === "active") {
                    setState("active");
                    setMessage("Terminal tekshirilmoqda...");
                } else {
                    setState("waiting");
                    setMessage(`Redis holati: ${data.state}`);
                }

                scheduleNext();
            } catch (error: unknown) {
                if (stopped || controller.signal.aborted) return;

                setState("stopped");
                setMessage(
                    error instanceof Error
                        ? `Kuzatishda xatolik: ${error.message}`
                        : "Vazifa holatini olib bo‘lmadi.",
                );
            }
        }

        void poll();

        return () => {
            stopped = true;
            controller.abort();

            if (timer !== null) {
                clearTimeout(timer);
            }
        };
    }, [jobId, terminalId]);

    async function handleCheck() {
        if (
            submittingRef.current ||
            (jobId !== null &&
                (state === "waiting" || state === "active"))
        ) {
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setMessage("");
        setState("waiting");

        try {
            const response = await authorizedPost<EnqueueResponse>(
                `/person-sync-queue/terminals/${terminalId}/check`,
                {},
            );

            if (!response.queued || !response.jobId) {
                setState("failed");
                setMessage(
                    response.reason === "TERMINAL_INACTIVE"
                        ? "Terminal nofaol."
                        : response.reason ?? "Vazifa navbatga qo‘shilmadi.",
                );
                return;
            }

            setJobId(response.jobId);
            setMessage("Diagnostika vazifasi navbatga yuborildi.");
        } catch (error: unknown) {
            setState("failed");
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Vazifani yuborib bo‘lmadi.",
            );
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    const watching =
        jobId !== null &&
        (state === "waiting" || state === "active");

    return (
        <div className="space-y-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting || watching}
                onClick={() => {
                    if (jobId !== null && !watching) {
                        setJobId(null);
                    }
                    void handleCheck();
                }}
            >
                {submitting || watching ? (
                    <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                ) : (
                    <RotateCw aria-hidden="true" className="size-4" />
                )}
                {submitting
                    ? "Yuborilmoqda"
                    : watching
                        ? "Tekshirilmoqda"
                        : "Qayta tekshirish"}
            </Button>

            {message && (
                <p
                    role="status"
                    className={
                        state === "failed"
                            ? "max-w-56 text-xs text-destructive"
                            : "max-w-56 text-xs text-muted-foreground"
                    }
                >
                    {message}
                </p>
            )}
        </div>
    );
}
