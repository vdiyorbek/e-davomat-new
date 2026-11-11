
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authorizedPost } from "@/lib/auth-session";

type SyncType = "STUDENT" | "TEACHER" | "BOTH";

interface BulkSyncResponse {
    success: boolean;
    dryRun: boolean;
    type: SyncType;
    results: Array<{
        terminalId: number;
        schoolId: number;
        candidates: number;
        hasMore: boolean;
        queued: number;
        reused: number;
        failed: number;
    }>;
}

interface Props {
    terminalIds: number[];
    onSubmitted?: () => void;
}

export function BulkPersonSyncPanel({
    terminalIds,
    onSubmitted,
}: Props) {
    const [type, setType] = useState<SyncType>("BOTH");
    const [limit, setLimit] = useState(10);
    const [preview, setPreview] =
        useState<BulkSyncResponse | null>(null);
    const [previewIds, setPreviewIds] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] =
        useState<BulkSyncResponse | null>(null);

    const canApply =
        preview !== null &&
        previewIds.join(",") === terminalIds.join(",") &&
        terminalIds.length > 0 &&
        terminalIds.length <= 5;

    async function submit(dryRun: boolean) {
        if (busy || terminalIds.length === 0) return;

        setBusy(true);
        setError("");

        try {
            const response = await authorizedPost<BulkSyncResponse>(
                "/terminals/bulk/person-sync",
                {
                    terminalIds,
                    type,
                    limitPerTerminal: limit,
                    dryRun,
                    ...(dryRun
                        ? {}
                        : { confirm: "SYNC_SELECTED_PERSONS" }),
                },
            );

            if (dryRun) {
                setPreview(response);
                setPreviewIds([...terminalIds]);
                setResult(null);
            } else {
                setResult(response);
                setPreview(null);
                onSubmitted?.();
            }
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Sinxronlash so‘rovi bajarilmadi",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3 rounded-xl border p-4">
            <div className="font-semibold">
                Shaxslarni terminallarga sinxronlash
            </div>

            <p className="text-sm text-muted-foreground">
                Tanlangan terminallar: {terminalIds.length} ta.
                Bir so‘rovda ko‘pi bilan 5 ta terminal.
            </p>

            <div className="flex flex-wrap gap-3">
                <label className="space-y-1 text-sm">
                    <span className="block">Shaxslar</span>
                    <select
                        value={type}
                        onChange={(event) => {
                            setType(event.target.value as SyncType);
                            setPreview(null);
                        }}
                        className="h-9 rounded-md border bg-background px-3"
                    >
                        <option value="BOTH">O‘quvchi va o‘qituvchilar</option>
                        <option value="STUDENT">Faqat o‘quvchilar</option>
                        <option value="TEACHER">Faqat o‘qituvchilar</option>
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="block">Har terminal uchun</span>
                    <select
                        value={limit}
                        onChange={(event) => {
                            setLimit(Number(event.target.value));
                            setPreview(null);
                        }}
                        className="h-9 rounded-md border bg-background px-3"
                    >
                        {[1, 5, 10, 20].map((value) => (
                            <option key={value} value={value}>
                                {value} ta
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <Button
                type="button"
                variant="outline"
                disabled={
                    busy ||
                    terminalIds.length < 1 ||
                    terminalIds.length > 5
                }
                onClick={() => void submit(true)}
            >
                {busy ? "Tekshirilmoqda..." : "Oldindan tekshirish"}
            </Button>

            {preview && (
                <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">
                        Sinxronlash rejasi (dry-run)
                    </p>

                    {preview.results.map((item) => (
                        <p key={item.terminalId} className="text-sm">
                            Terminal #{item.terminalId}:{" "}
                            {item.candidates} ta nomzod
                            {item.hasMore ? " (boshqalari ham mavjud)" : ""}
                        </p>
                    ))}

                    <p className="text-xs text-muted-foreground">
                        Bu nomzodlar soni, hali terminalda
                        yetishmayotgan shaxslar soni emas.
                    </p>

                    <Button
                        type="button"
                        disabled={!canApply || busy}
                        onClick={() => void submit(false)}
                    >
                        {busy
                            ? "Navbatga yuborilmoqda..."
                            : "Tasdiqlash va navbatga yuborish"}
                    </Button>
                </div>
            )}

            {result && (
                <div className="space-y-1 text-sm">
                    {result.results.map((item) => (
                        <p key={item.terminalId}>
                            #{item.terminalId}: navbatga {item.queued},
                            mavjud vazifa {item.reused},
                            xato {item.failed}
                        </p>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        Navbatga qo‘yish tugadi. Qurilmadagi
                        sinxronlash natijasini monitoring orqali tekshiring.
                    </p>
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </section>
    );
}
