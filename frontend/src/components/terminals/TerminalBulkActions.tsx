
import { useState } from "react";
import {
    RefreshCw,
    ShieldCheck,
    Users,
    Power,
    CalendarClock,
} from "lucide-react";
import { todayInTashkent } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { authorizedPost } from "@/lib/auth-session";
import { BulkPersonSyncPanel } from "./BulkPersonSyncPanel";

interface PreviewResult {
    terminalId: number;
    status: string;
    personsCount: number | null;
}

interface ClearPreviewResponse {
    success: boolean;
    dryRun: boolean;
    willDelete: boolean;
    results: PreviewResult[];
}

interface Props {
    terminalIds: number[];
    onSubmitted: () => void;
    onClear: () => void;
}

export function TerminalBulkActions({
    terminalIds,
    onSubmitted,
    onClear,
}: Props) {
    const [section, setSection] = useState<
        "sync" | "memory" | "sync-time" | null
    >(null);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] =
        useState<ClearPreviewResponse | null>(null);


    const [syncStartDate, setSyncStartDate] =
        useState(todayInTashkent);

    const [savingSyncTime, setSavingSyncTime] = useState(false);

    async function saveBulkSyncTime() {
        if (
            savingSyncTime ||
            terminalIds.length === 0 ||
            terminalIds.length > 100
        ) {
            return;
        }

        if (!/^20\d{2}-\d{2}-\d{2}$/.test(syncStartDate)) {
            setError("Sanani to‘g‘ri kiriting");
            return;
        }

        const startTime =
            `${syncStartDate}T00:00:00+05:00`;

        const timestamp = Date.parse(startTime);

        if (
            !Number.isFinite(timestamp) ||
            timestamp > Date.now() ||
            new Date(timestamp + 5 * 3600_000)
                .toISOString()
                .slice(0, 10) !== syncStartDate
        ) {
            setError("Noto‘g‘ri yoki kelajakdagi sana");
            return;
        }

        const confirmed = window.confirm(
            `${terminalIds.length} ta terminal uchun ` +
            `${syncStartDate} sanasidan sinxronlashni boshlaysizmi?\n\n` +
            "Avval sinxronlangan terminallarning vaqti o‘zgartirilmaydi.",
        );

        if (!confirmed) return;

        setSavingSyncTime(true);
        setError("");

        try {
            const result = await authorizedPost<{
                success: boolean;
                updated: number;
                syncStartAt: string;
            }>("/terminals/bulk/sync-start", {
                terminalIds,
                startTime,
                confirm: "SET_BULK_SYNC_START",
            });

            window.alert(
                `${result.updated} ta terminal uchun ` +
                "sinxronlash vaqti belgilandi.",
            );

            setSection(null);
            onSubmitted();
            onClear();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Sinxronlash vaqtini saqlab bo‘lmadi",
            );
        } finally {
            setSavingSyncTime(false);
        }
    }

    const [previewKey, setPreviewKey] = useState("");

    const [activating, setActivating] = useState(false);
    async function activateSelected() {
        if (
            activating ||
            terminalIds.length === 0 ||
            terminalIds.length > 100
        ) {
            return;
        }

        const confirmed = window.confirm(
            `${terminalIds.length} ta terminalning tizim holatini faollashtirasizmi?`,
        );

        if (!confirmed) return;

        setActivating(true);
        setError("");

        try {
            const result = await authorizedPost<{
                success: boolean;
                selected: number;
                activated: number;
                alreadyActive: number;
            }>("/terminals/bulk/activate", {
                terminalIds,
                confirm: "ACTIVATE_SELECTED_TERMINALS",
            });

            window.alert(
                `Faollashtirildi: ${result.activated} ta.\n` +
                `Avvaldan faol: ${result.alreadyActive} ta.`,
            );

            onSubmitted();
            onClear();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Terminallarni faollashtirib bo‘lmadi",
            );
        } finally {
            setActivating(false);
        }
    }
    const selectionKey = [...terminalIds]
        .sort((a, b) => a - b)
        .join(",");

    async function checkMemory() {
        if (busy || terminalIds.length > 5) return;

        setBusy(true);
        setError("");
        setPreview(null);

        try {
            const data = await authorizedPost<ClearPreviewResponse>(
                "/terminals/bulk/clear-preview",
                { terminalIds },
            );

            setPreview(data);
            setPreviewKey(selectionKey);
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Terminal xotirasini tekshirib bo‘lmadi",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                    Tanlangan terminallar: {terminalIds.length} ta
                </span>

                <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                        setSection(null);
                        setPreview(null);
                        onClear();
                    }}
                >
                    Tanlovni tozalash
                </Button>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={section === "sync" ? "default" : "outline"}
                    onClick={() =>
                        setSection(section === "sync" ? null : "sync")
                    }
                >
                    <Users className="size-4" />
                    Sinxronlash
                </Button>

                <Button
                    type="button"
                    size="sm"
                    variant={section === "sync-time" ? "default" : "outline"}
                    onClick={() =>
                        setSection(section === "sync-time" ? null : "sync-time")
                    }
                >
                    <CalendarClock className="size-4" />
                    Sinxronlash vaqtini belgilash
                </Button>

                <Button
                    type="button"
                    size="sm"
                    variant={section === "memory" ? "default" : "outline"}
                    onClick={() =>
                        setSection(section === "memory" ? null : "memory")
                    }
                >
                    <ShieldCheck className="size-4" />
                    Xotirani tekshirish
                </Button>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                        activating ||
                        terminalIds.length === 0 ||
                        terminalIds.length > 100
                    }
                    onClick={() => void activateSelected()}
                >
                    <Power className="size-4" />
                    {activating
                        ? "Faollashtirilmoqda..."
                        : "Tizim holatini faollashtirish"}
                </Button>

            </div>

            {section === "sync" && (
                <BulkPersonSyncPanel
                    terminalIds={terminalIds}
                    onSubmitted={onSubmitted}
                />
            )}

            {section === "memory" && (
                <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">
                        Qurilmalarda ro‘yxatdan o‘tgan shaxslar
                        sonini tekshiramiz. Hech narsa o‘chirilmaydi.
                    </p>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                            busy ||
                            terminalIds.length === 0 ||
                            terminalIds.length > 5
                        }
                        onClick={() => void checkMemory()}
                    >
                        <RefreshCw className="size-4" />
                        {busy ? "Tekshirilmoqda..." : "Tekshirish"}
                    </Button>

                    {preview && previewKey === selectionKey && (
                        <div className="space-y-2">
                            {preview.results.map((item) => (
                                <div
                                    key={item.terminalId}
                                    className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"
                                >
                                    <span>Terminal #{item.terminalId}</span>
                                    <span>
                                        {item.status === "READY"
                                            ? `${item.personsCount ?? 0} ta shaxs`
                                            : item.status === "INACTIVE"
                                                ? "Nofaol"
                                                : "Tekshirishda xatolik"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Qurilmadan o‘chirish amali hozircha mavjud emas.
                    </p>
                </div>
            )}

            {section === "sync-time" && (
                <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">
                        Eventlarni qaysi sanadan boshlab olish kerak?
                    </p>

                    <input
                        type="date"
                        min="2000-01-01"
                        max={todayInTashkent()}
                        value={syncStartDate}
                        onChange={(event) =>
                            setSyncStartDate(event.target.value)
                        }
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                    />

                    <p className="text-xs text-muted-foreground">
                        Vaqt: 00:00 (Toshkent).
                        Faqat hali sinxronlash boshlanmagan,
                        faol terminallarga qo‘llanadi.
                    </p>

                    <Button
                        type="button"
                        size="sm"
                        disabled={
                            savingSyncTime ||
                            terminalIds.length === 0 ||
                            terminalIds.length > 100
                        }
                        onClick={() => void saveBulkSyncTime()}
                    >
                        {savingSyncTime
                            ? "Saqlanmoqda..."
                            : "Vaqtni belgilash"}
                    </Button>
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
