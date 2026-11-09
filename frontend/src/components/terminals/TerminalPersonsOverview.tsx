
import { useState } from "react";
import { RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { authorizedGet } from "@/lib/auth-session";

interface PersonSummary {
    total: number;
    withPhoto: number;
    withoutPhoto: number;
}

interface PreviewResponse {
    terminalId: number;
    terminalName: string;
    schoolId: number;
    date: string;
    students: PersonSummary;
    teachers: PersonSummary;
    summary: PersonSummary;
    note: string;
}

interface CompareResponse {
    databasePersons: number;
    terminalPersons: number;
    matched: number;
    missingOnTerminal: number;
    extraOnTerminal: number;
    invalidEmployeeNo: number;
    comparedAt: string;
    note: string;
}

function NumberCard({
    title,
    value,
}: {
    title: string;
    value: number;
}) {
    return (
        <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
                {value.toLocaleString("uz-UZ")}
            </p>
        </div>
    );
}

export function TerminalPersonsOverview({
    terminalId,
}: {
    terminalId: number;
}) {
    const preview = useApiQuery<PreviewResponse>(
        `/terminals/${terminalId}/person-sync/preview`,
    );

    const [comparison, setComparison] =
        useState<CompareResponse | null>(null);

    const [checking, setChecking] = useState(false);
    const [error, setError] = useState("");

    async function comparePersons() {
        if (checking) return;

        setChecking(true);
        setError("");
        setComparison(null);

        try {
            const result = await authorizedGet<CompareResponse>(
                `/terminals/${terminalId}/person-sync/compare`,
            );

            setComparison(result);
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Terminal bilan solishtirishda xatolik yuz berdi.",
            );
        } finally {
            setChecking(false);
        }
    }

    return (
        <section className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="size-5" aria-hidden="true" />
                    <h3 className="font-semibold">
                        O‘quvchilar va o‘qituvchilar
                    </h3>
                </div>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={preview.retry}
                    disabled={preview.loading}
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Yangilash
                </Button>
            </div>

            {preview.loading && (
                <p className="text-sm text-muted-foreground">
                    Maktab ma’lumotlari yuklanmoqda...
                </p>
            )}

            {preview.error && (
                <p role="alert" className="text-sm text-destructive">
                    {preview.error}
                </p>
            )}

            {preview.data && (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberCard
                            title="O‘quvchilar"
                            value={preview.data.students.total}
                        />
                        <NumberCard
                            title="O‘qituvchilar"
                            value={preview.data.teachers.total}
                        />
                        <NumberCard
                            title="Rasmi bor"
                            value={preview.data.summary.withPhoto}
                        />
                        <NumberCard
                            title="Rasmi yo‘q"
                            value={preview.data.summary.withoutPhoto}
                        />
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Jami: {preview.data.summary.total} shaxs.
                        Rasm mavjudligi hozircha faqat photoUrl
                        bo‘yicha hisoblangan.
                    </p>
                </>
            )}

            <div className="space-y-3 border-t pt-4">
                <Button
                    type="button"
                    className="w-full"
                    onClick={() => void comparePersons()}
                    disabled={checking || preview.loading}
                >
                    {checking
                        ? "Solishtirilmoqda..."
                        : "Terminal bilan solishtirish"}
                </Button>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {comparison && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <NumberCard
                                title="Bazadagi shaxslar"
                                value={comparison.databasePersons}
                            />
                            <NumberCard
                                title="Terminaldagi shaxslar"
                                value={comparison.terminalPersons}
                            />
                            <NumberCard
                                title="Mos kelganlar"
                                value={comparison.matched}
                            />
                            <NumberCard
                                title="Terminalda yo‘qlar"
                                value={comparison.missingOnTerminal}
                            />
                            <NumberCard
                                title="Terminaldagi ortiqcha yozuvlar"
                                value={comparison.extraOnTerminal}
                            />
                            <NumberCard
                                title="Noto‘g‘ri employeeNo"
                                value={comparison.invalidEmployeeNo}
                            />
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {comparison.note}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
