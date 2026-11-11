import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedGet, authorizedPost } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import {
    clearErrorKey,
    sleep,
    type ClearJobResponse,
    type ClearResult,
} from "@/lib/terminal-clear";

type Phase = "idle" | "running" | "done" | "failed";

const POLL_MS = 3000;
const MAX_WAIT_MS = 12 * 60_000;

export function TerminalClearPersonsAction({
    terminalId,
    terminalName,
    onFinished,
}: {
    terminalId: number;
    terminalName: string;
    onFinished: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");
    const [message, setMessage] = useState("");
    const [result, setResult] = useState<ClearResult | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Komponent yopilsa, kuzatishni to‘xtatamiz (backend ishini davom ettiradi).
    useEffect(() => () => abortRef.current?.abort(), []);

    const running = phase === "running";
    const nameMatches = typed.trim() === terminalName.trim();

    function translateError(raw: string | null | undefined) {
        const key = clearErrorKey(raw);
        return key ? t(key) : raw || t("terminals.clearPersons.errors.generic");
    }

    function reset() {
        setTyped("");
        setPhase("idle");
        setMessage("");
        setResult(null);
    }

    async function handleConfirm() {
        if (running || !nameMatches) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setPhase("running");
        setResult(null);
        setMessage(t("terminals.clearPersons.running"));

        try {
            const { jobId } = await authorizedPost<{ jobId: string }>(
                `/person-sync-queue/terminals/${terminalId}/clear`,
                { confirm: "CLEAR_TERMINAL_PERSONS" },
            );

            if (!jobId) {
                throw new Error(t("terminals.clearPersons.errors.generic"));
            }

            const startedAt = Date.now();

            while (Date.now() - startedAt < MAX_WAIT_MS) {
                await sleep(POLL_MS, controller.signal);

                const job = await authorizedGet<ClearJobResponse>(
                    `/person-sync-queue/jobs/${encodeURIComponent(jobId)}`,
                    controller.signal,
                );

                if (job.state === "completed" && job.result) {
                    setResult(job.result);
                    setPhase(job.result.cleared ? "done" : "failed");
                    setMessage(
                        job.result.cleared
                            ? t("terminals.clearPersons.done")
                            : t("terminals.clearPersons.partial", {
                                count: job.result.usersAfter,
                            }),
                    );
                    onFinished();
                    return;
                }

                if (job.state === "failed") {
                    setPhase("failed");
                    setMessage(translateError(job.error));
                    onFinished();
                    return;
                }
            }

            setPhase("failed");
            setMessage(t("terminals.clearPersons.errors.watchTimeout"));
        } catch (error: unknown) {
            if (controller.signal.aborted) return;

            setPhase("failed");
            setMessage(
                error instanceof Error
                    ? translateError(error.message)
                    : t("terminals.clearPersons.errors.generic"),
            );
        }
    }

    const inputId = `clear-terminal-${terminalId}`;

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (running) return;
                setOpen(next);
                if (!next) reset();
            }}
        >
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <Eraser aria-hidden="true" className="size-4" />
                    {t("terminals.clearPersons.button")}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("terminals.clearPersons.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("terminals.clearPersons.description", {
                            name: terminalName,
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {phase === "idle" ? (
                    <div className="space-y-4 text-sm">
                        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                            <li>{t("terminals.clearPersons.warnAll")}</li>
                            <li>{t("terminals.clearPersons.warnEvents")}</li>
                            <li>{t("terminals.clearPersons.warnResync")}</li>
                        </ul>

                        <div className="space-y-1.5">
                            <Label htmlFor={inputId} className="leading-snug">
                                {t("terminals.clearPersons.confirmLabel", {
                                    name: terminalName,
                                })}
                            </Label>
                            <Input
                                id={inputId}
                                value={typed}
                                autoComplete="off"
                                placeholder={terminalName}
                                onChange={(event) => setTyped(event.target.value)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p
                            role="status"
                            className={cn(
                                "flex items-start gap-2 text-sm",
                                phase === "failed" && "text-destructive",
                                phase === "done" && "text-emerald-600 dark:text-emerald-400",
                            )}
                        >
                            {running && (
                                <Loader2
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 animate-spin"
                                />
                            )}
                            {message}
                        </p>

                        {result && (
                            <dl className="grid grid-cols-3 gap-2 text-center">
                                {[
                                    ["before", result.usersBefore],
                                    ["after", result.usersAfter],
                                    ["faces", result.facesAfter],
                                ].map(([key, value]) => (
                                    <div key={key} className="rounded-lg border bg-muted/30 p-2">
                                        <dt className="text-xs text-muted-foreground">
                                            {t(`terminals.clearPersons.${key}`)}
                                        </dt>
                                        <dd className="text-lg font-semibold tabular-nums">
                                            {value ?? t("terminals.clearPersons.unknown")}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                )}

                <AlertDialogFooter>
                    {phase !== "idle" && !running && (
                        <Button asChild variant="ghost">
                            <Link to="/terminals/sync-history?tab=clears">
                                {t("terminals.clearPersons.viewHistory")}
                            </Link>
                        </Button>
                    )}

                    <AlertDialogCancel disabled={running}>
                        {phase === "idle"
                            ? t("terminals.clearPersons.cancel")
                            : t("terminals.clearPersons.close")}
                    </AlertDialogCancel>

                    {phase === "idle" && (
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={!nameMatches}
                            onClick={() => void handleConfirm()}
                        >
                            {t("terminals.clearPersons.confirm")}
                        </Button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}