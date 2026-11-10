
import { useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { authorizedPost } from "@/lib/auth-session";

interface PhotoStats {
    terminalId: number;
    total: number;
    pending: number;
    downloaded: number;
    failed: number;
    missing: number;
}

interface PhotoStatsResponse {
    success: boolean;
    terminals: PhotoStats[];
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
    const { data, loading, error, retry } =
        useApiQuery<PhotoStatsResponse>(
            "/attendance-events/photos/stats",
        );

    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [actionError, setActionError] = useState("");

    const stats = data?.terminals.find(
        (item) => item.terminalId === terminalId,
    );

    const format = (value: number) =>
        value.toLocaleString("uz-UZ");

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
                `${format(result.reset)} ta rasm qayta tekshirishga yuborildi.`,
            );

            retry();
        } catch (caught: unknown) {
            setActionError(
                caught instanceof Error
                    ? caught.message
                    : "Rasmlarni qayta tekshirib bo‘lmadi",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                    <Camera aria-hidden="true" className="size-4" />
                    Davomat rasmlari
                </h3>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={retry}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Yangilash
                </Button>
            </div>

            {loading && (
                <p className="text-sm text-muted-foreground">
                    Foto statistikasi yuklanmoqda...
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {!loading && !error && !stats && (
                <p className="text-sm text-muted-foreground">
                    Ushbu terminal uchun hali foto eventi mavjud emas.
                </p>
            )}

            {stats && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <StatBox
                            label="Yuklangan"
                            value={stats.downloaded}
                        />
                        <StatBox
                            label="Navbatda"
                            value={stats.pending}
                        />
                        <StatBox
                            label="Xatolik"
                            value={stats.failed}
                        />
                        <StatBox
                            label="Mavjud emas"
                            value={stats.missing}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Yuklanish ko‘rsatkichi</span>
                            <span>
                                {stats.total > 0
                                    ? Math.round(
                                        (stats.downloaded / stats.total) * 100,
                                    )
                                    : 0}
                                %
                            </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{
                                    width: `${stats.total > 0
                                            ? (stats.downloaded / stats.total) * 100
                                            : 0
                                        }%`,
                                }}
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
                            <RefreshCw
                                aria-hidden="true"
                                className="size-4"
                            />
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

            <p className="text-xs text-muted-foreground">
                Qayta tekshirish rasmlarni darhol yuklamaydi.
                Ularni keyingi avtomatik sinxronlashga tayyorlaydi.
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
