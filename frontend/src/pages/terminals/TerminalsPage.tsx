import { useEffect, useRef, useState } from "react";
import {
    Archive,
    ArchiveRestore,
    Info,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ScanFace,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { SelectField } from "@/components/common/SelectField";
import {
    EmptyState,
    ErrorState,
    LoadingState,
    SuccessNotice,
} from "@/components/common/states";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CheckTerminalButton } from "@/components/terminals/CheckTerminalButton";
import { CreateTerminalForm } from "@/components/terminals/CreateTerminalForm";
import { EditTerminalForm } from "@/components/terminals/EditTerminalForm";
import { StartTerminalSyncForm } from "@/components/terminals/StartTerminalSyncForm";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { authorizedDelete, authorizedGet, authorizedPost } from "@/lib/auth-session";
import { formatDateTime } from "@/lib/date";
import { schoolScopeOptions } from "@/lib/school-scope";
import type { School } from "@/types/school";
import type {
    Terminal,
    TerminalDirection,
    TerminalsPageResponse,
} from "@/types/terminal";

type ArchiveStatus = "ACTIVE" | "ARCHIVED" | "ALL";
type ActionMode = "archive" | "restore";

function healthBadge(terminal: Terminal) {
    switch (terminal.healthStatus) {
        case "ONLINE":
            return { text: "Online", tone: "success" as const };
        case "OFFLINE":
            return { text: "Offline", tone: "danger" as const };
        case "ARCHIVED":
            return { text: "Arxiv", tone: "neutral" as const };
        case "DISABLED":
            return { text: "O‘chirilgan", tone: "warning" as const };
        default:
            return { text: "Tekshirilmagan", tone: "neutral" as const };
    }
}

type ArchiveAwareTerminal = Terminal & {
    archivedAt?: string | null;
};

function isArchived(terminal: Terminal): boolean {
    return Boolean((terminal as ArchiveAwareTerminal).archivedAt);
}

interface PersonsPreview {
    students: { total: number; withPhoto: number; withoutPhoto: number };
    teachers: { total: number; withPhoto: number; withoutPhoto: number };
    summary: { total: number; withPhoto: number; withoutPhoto: number };
}

interface PersonsCompare {
    databasePersons: number;
    terminalPersons: number;
    matched: number;
    missingOnTerminal: number;
    extraOnTerminal: number;
    invalidEmployeeNo: number;
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border bg-muted/25 p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
                {value.toLocaleString("uz-UZ")}
            </div>
        </div>
    );
}

function PersonsSummary({ terminalId }: { terminalId: number }) {
    const preview = useApiQuery<PersonsPreview>(
        `/terminals/${terminalId}/person-sync/preview`,
    );
    const [compare, setCompare] = useState<PersonsCompare | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function handleCompare() {
        if (busy) return;
        setBusy(true);
        setError("");
        setCompare(null);
        try {
            setCompare(
                await authorizedGet<PersonsCompare>(
                    `/terminals/${terminalId}/person-sync/compare`,
                ),
            );
        } catch (caught: unknown) {
            setError(
                caught instanceof Error ? caught.message : "Solishtirib bo‘lmadi",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Maktabdagi shaxslar</h3>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={preview.retry}
                    disabled={preview.loading}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Yangilash
                </Button>
            </div>

            {preview.loading && (
                <p className="text-sm text-muted-foreground">Ma’lumotlar yuklanmoqda...</p>
            )}
            {preview.error && (
                <p role="alert" className="text-sm text-destructive">{preview.error}</p>
            )}
            {preview.data && (
                <div className="grid grid-cols-2 gap-2">
                    <Stat label="O‘quvchilar" value={preview.data.students.total} />
                    <Stat label="O‘qituvchilar" value={preview.data.teachers.total} />
                    <Stat label="Rasmi bor" value={preview.data.summary.withPhoto} />
                    <Stat label="Rasmi yo‘q" value={preview.data.summary.withoutPhoto} />
                </div>
            )}

            <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy || preview.loading || !preview.data}
                onClick={() => void handleCompare()}
            >
                {busy ? "Solishtirilmoqda..." : "Terminal bilan solishtirish"}
            </Button>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {compare && (
                <div className="grid grid-cols-2 gap-2">
                    <Stat label="Terminaldagi shaxslar" value={compare.terminalPersons} />
                    <Stat label="Mos kelganlar" value={compare.matched} />
                    <Stat label="Terminalda yo‘qlar" value={compare.missingOnTerminal} />
                    <Stat label="Ortiqcha yozuvlar" value={compare.extraOnTerminal} />
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                Bu yerda PNFL/employeeNo mosligi tekshiriladi. Yuz rasmining
                haqiqiy holati alohida tekshiriladi.
            </p>
        </section>
    );
}

function TerminalDetails({
    terminal,
    canManage,
    onClose,
    onChanged,
}: {
    terminal: Terminal;
    canManage: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const archived = isArchived(terminal);

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        <ScanFace aria-hidden="true" className="size-5" />
                        {terminal.name} <span className="text-sm text-muted-foreground">#{terminal.id}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {terminal.school.region.name} / {terminal.school.district.name} / {terminal.school.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                        <h3 className="font-semibold">Qurilma ma’lumotlari</h3>
                        <dl className="grid grid-cols-[minmax(90px,auto)_1fr] gap-2 rounded-xl border bg-muted/20 p-4 text-sm">
                            <dt className="text-muted-foreground">IP manzil</dt>
                            <dd className="break-all font-mono">{terminal.host}:{terminal.port}</dd>
                            <dt className="text-muted-foreground">Protokol</dt>
                            <dd>{terminal.protocol}</dd>
                            <dt className="text-muted-foreground">Login</dt>
                            <dd>{terminal.username}</dd>
                            <dt className="text-muted-foreground">Yo‘nalish</dt>
                            <dd>{terminal.direction === "IN" ? "Kirish" : "Chiqish"}</dd>
                            <dt className="text-muted-foreground">Model</dt>
                            <dd>{terminal.model ?? "—"}</dd>
                            <dt className="text-muted-foreground">Seriya raqami</dt>
                            <dd className="break-all">{terminal.serialNumber ?? "—"}</dd>
                            <dt className="text-muted-foreground">Holat</dt>
                            <dd>
                                <StatusBadge tone={healthBadge(terminal).tone}>
                                    {healthBadge(terminal).text}
                                </StatusBadge>
                            </dd>
                            <dt className="text-muted-foreground">Oxirgi tekshiruv</dt>
                            <dd>{formatDateTime(terminal.lastCheckedAt, "—")}</dd>
                            <dt className="text-muted-foreground">Oxirgi muvaffaqiyatli ulanish</dt>
                            <dd>{formatDateTime(terminal.lastSeenAt, "—")}</dd>
                        </dl>
                        {terminal.healthStatus === "OFFLINE" && terminal.lastError && (
                            <p className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive break-words">
                                Oxirgi xatolik: {terminal.lastError}
                            </p>
                        )}
                        {terminal.healthStatus === "UNKNOWN" && (
                            <p className="text-xs text-muted-foreground">
                                Oxirgi ulanish tekshiruvi eskirgan yoki hali bajarilmagan.
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        {archived ? (
                            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                                Terminal arxivlangan. Sinxronlash va qurilma so‘rovlari
                                arxivdan tiklangandan keyin tekshiriladi.
                            </div>
                        ) : (
                            <PersonsSummary key={terminal.id} terminalId={terminal.id} />
                        )}
                    </div>
                </div>

                {canManage && !archived && (
                    <details className="rounded-xl border p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                            Qo‘shimcha sozlamalar va diagnostika
                        </summary>
                        <div className="mt-3 space-y-3 border-t pt-3">
                            <CheckTerminalButton terminalId={terminal.id} />
                            {!terminal.syncStartAt && (
                                <StartTerminalSyncForm
                                    terminalId={terminal.id}
                                    isActive={terminal.isActive}
                                    onStarted={() => { onChanged(); onClose(); }}
                                />
                            )}
                        </div>
                    </details>
                )}

                <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={onClose}>Yopish</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function TerminalsPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const role = session?.profile.role;
    const canManage = role === "SUPER_ADMIN";
    const canSelectRegion = role === "SUPER_ADMIN";
    const canSelectDistrict = canSelectRegion || role === "REGION_ADMIN";
    const canSelectSchool = canSelectDistrict || role === "DISTRICT_ADMIN";

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [regionId, setRegionId] = useState("");
    const [districtId, setDistrictId] = useState("");
    const [schoolId, setSchoolId] = useState("");
    const [direction, setDirection] = useState<TerminalDirection | "">("");
    const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("ACTIVE");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [selected, setSelected] = useState<Terminal | null>(null);
    const [editing, setEditing] = useState<Terminal | null>(null);
    const [action, setAction] = useState<{ terminal: Terminal; mode: ActionMode } | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const [success, setSuccess] = useState("");

    const schools = useApiQuery<School[]>("/schools");
    const scope = schoolScopeOptions(schools.data, regionId, districtId);

    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        archiveStatus,
    });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (schoolId) params.set("schoolId", schoolId);
    if (direction) params.set("direction", direction);
    if (search) params.set("search", search);

    const terminals = useApiQuery<TerminalsPageResponse>(
        `/terminals?${params.toString()}`,
    );

    // Backend 2 daqiqada HealthCheck qiladi; jadval 30 soniyada natijani yangilaydi.
    const retryRef = useRef(terminals.retry);
    retryRef.current = terminals.retry;
    useEffect(() => {
        const interval = window.setInterval(() => retryRef.current(), 30_000);
        return () => window.clearInterval(interval);
    }, []);

    function refresh() {
        terminals.retry();
    }

    function resetFilters() {
        setRegionId("");
        setDistrictId("");
        setSchoolId("");
        setDirection("");
        setSearchInput("");
        setSearch("");
        setArchiveStatus("ACTIVE");
        setPage(1);
    }

    async function confirmArchiveAction() {
        if (!action || actionBusy) return;
        setActionBusy(true);
        setActionError("");
        try {
            if (action.mode === "archive") {
                await authorizedDelete(`/terminals/${action.terminal.id}`);
                setSuccess("Terminal arxivlandi. Davomat tarixi saqlanib qoldi.");
            } else {
                await authorizedPost(`/terminals/${action.terminal.id}/restore`, {});
                setSuccess("Terminal arxivdan tiklandi (hozircha nofaol).");
            }
            setAction(null);
            setSelected(null);
            refresh();
        } catch (caught: unknown) {
            setActionError(
                caught instanceof Error ? caught.message : "Amal bajarilmadi",
            );
        } finally {
            setActionBusy(false);
        }
    }

    return (
        <div className="min-w-0 space-y-4">
            <PageHeader
                eyebrow="E-Davomat / Hikvision"
                title={t("terminals.title")}
                description="Terminallarni qidirish, tahrirlash va boshqarish"
                actions={canManage ? (
                    <Button type="button" onClick={() => setCreateOpen(true)}>
                        <Plus aria-hidden="true" className="size-4" />
                        Terminal qo‘shish
                    </Button>
                ) : undefined}
            />

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <Card className="gap-0">
                <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Search aria-hidden="true" className="size-4" />
                        Filtr va qidiruv
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {canSelectRegion && (
                            <SelectField
                                value={regionId}
                                onValueChange={(v) => {
                                    setRegionId(v);
                                    setDistrictId("");
                                    setSchoolId("");
                                    setPage(1);
                                }}
                                emptyOption="Barcha viloyatlar"
                                options={scope.regions}
                                searchable
                                aria-label="Viloyat"
                            />
                        )}
                        {canSelectDistrict && (
                            <SelectField
                                value={districtId}
                                onValueChange={(v) => {
                                    setDistrictId(v);
                                    setSchoolId("");
                                    setPage(1);
                                }}
                                emptyOption="Barcha tumanlar"
                                options={scope.districts}
                                searchable
                                aria-label="Tuman"
                            />
                        )}
                        {canSelectSchool && (
                            <SelectField
                                value={schoolId}
                                onValueChange={(v) => { setSchoolId(v); setPage(1); }}
                                emptyOption="Barcha maktablar"
                                options={scope.schools}
                                searchable
                                aria-label="Maktab"
                            />
                        )}
                        <form
                            className="flex min-w-0 gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                setSearch(searchInput.trim());
                                setPage(1);
                            }}
                        >
                            <Input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                aria-label="Terminal qidirish"
                                placeholder="Nomi, IP yoki ID..."
                            />
                            <Button type="submit" size="icon" aria-label="Qidirish">
                                <Search aria-hidden="true" className="size-4" />
                            </Button>
                        </form>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="w-40">
                            <SelectField
                                value={direction}
                                onValueChange={(value) => {
                                    if (value === "" || value === "IN" || value === "OUT") {
                                        setDirection(value);
                                        setPage(1);
                                    }
                                }}
                                emptyOption="Barcha yo‘nalishlar"
                                options={[
                                    { value: "IN", label: "Kirish" },
                                    { value: "OUT", label: "Chiqish" },
                                ]}
                                aria-label="Yo‘nalish"
                            />
                        </div>
                        <div className="w-44">
                            <SelectField
                                value={archiveStatus}
                                onValueChange={(value) => {
                                    if (value === "ACTIVE" || value === "ARCHIVED" || value === "ALL") {
                                        setArchiveStatus(value);
                                        setPage(1);
                                    }
                                }}
                                options={[
                                    { value: "ACTIVE", label: "Arxivlanmagan" },
                                    { value: "ARCHIVED", label: "Arxiv" },
                                    { value: "ALL", label: "Barchasi" },
                                ]}
                                aria-label="Arxiv holati"
                            />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                            Filtrlarni tozalash
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="min-w-0 gap-0">
                <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ScanFace aria-hidden="true" className="size-5" />
                            <div>
                                <h2 className="font-semibold">Turniketlar ro‘yxati</h2>
                                <p className="text-xs text-muted-foreground">
                                    {terminals.data ? `Jami: ${terminals.data.total.toLocaleString("uz-UZ")} ta` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={limit}
                                onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                                aria-label="Bir sahifadagi terminallar soni"
                            >
                                <option value={10}>10 / sahifa</option>
                                <option value={20}>20 / sahifa</option>
                                <option value={50}>50 / sahifa</option>
                                <option value={100}>100 / sahifa</option>
                            </select>
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                                Avto-yangilash: 30 s
                            </span>
                            <Button type="button" size="sm" variant="outline" onClick={refresh}>
                                <RefreshCw aria-hidden="true" className="size-4" />
                                Yangilash
                            </Button>
                        </div>
                    </div>

                    {terminals.loading ? (
                        <LoadingState label="Terminallar yuklanmoqda" />
                    ) : terminals.error || !terminals.data ? (
                        <ErrorState message={terminals.error || "Ma’lumotlar yuklanmadi"} onRetry={refresh} />
                    ) : terminals.data.data.length === 0 ? (
                        <EmptyState icon={ScanFace} title="Terminal topilmadi" description="Filtrlarni o‘zgartirib ko‘ring." />
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="w-full min-w-[780px] text-left text-sm">
                                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-3">ID</th>
                                            <th className="px-3 py-3">Maktab</th>
                                            <th className="px-3 py-3">Tuman</th>
                                            <th className="px-3 py-3">Nomi</th>
                                            <th className="px-3 py-3">IP manzil</th>
                                            <th className="px-3 py-3">Holat</th>
                                            <th className="px-3 py-3 text-right">Amallar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {terminals.data.data.map((terminal) => {
                                            const archived = isArchived(terminal);
                                            return (
                                                <tr key={terminal.id} className="border-t hover:bg-muted/25">
                                                    <td className="px-3 py-3 font-mono text-xs">{terminal.id}</td>
                                                    <td className="px-3 py-3 font-medium">{terminal.school.name}</td>
                                                    <td className="px-3 py-3">{terminal.school.district.name}</td>
                                                    <td className="px-3 py-3">
                                                        <div className="font-semibold">{terminal.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {terminal.direction === "IN" ? "Kirish" : "Chiqish"}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono text-xs">{terminal.host}</td>
                                                    <td className="px-3 py-3">
                                                        <StatusBadge tone={healthBadge(terminal).tone}>
                                                            {healthBadge(terminal).text}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                aria-label={`${terminal.name} ma’lumotlari`}
                                                                title="Ma’lumotlar"
                                                                onClick={() => setSelected(terminal)}
                                                            >
                                                                <Info aria-hidden="true" className="size-4" />
                                                            </Button>
                                                            {canManage && !archived && (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    aria-label={`${terminal.name} tahrirlash`}
                                                                    title="Tahrirlash"
                                                                    onClick={() => setEditing(terminal)}
                                                                >
                                                                    <Pencil aria-hidden="true" className="size-4" />
                                                                </Button>
                                                            )}
                                                            {canManage && (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    aria-label={archived ? "Arxivdan tiklash" : "Arxivlash"}
                                                                    title={archived ? "Arxivdan tiklash" : "Arxivlash"}
                                                                    onClick={() => {
                                                                        setAction({ terminal, mode: archived ? "restore" : "archive" });
                                                                        setActionError("");
                                                                    }}
                                                                >
                                                                    {archived ? (
                                                                        <ArchiveRestore aria-hidden="true" className="size-4" />
                                                                    ) : (
                                                                        <Archive aria-hidden="true" className="size-4" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                page={terminals.data.page}
                                totalPages={Math.max(1, terminals.data.totalPages)}
                                total={terminals.data.total}
                                pageSize={terminals.data.limit}
                                shownCount={terminals.data.data.length}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {selected && (
                <TerminalDetails
                    terminal={selected}
                    canManage={canManage}
                    onClose={() => setSelected(null)}
                    onChanged={refresh}
                />
            )}

            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Turniketni tahrirlash</DialogTitle>
                        <DialogDescription>Terminalning ulanish va tizim sozlamalari</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <EditTerminalForm
                            key={editing.id}
                            terminal={editing}
                            onCancel={() => setEditing(null)}
                            onSaved={() => {
                                setEditing(null);
                                setSuccess("Terminal ma’lumotlari yangilandi.");
                                refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Terminal qo‘shish</DialogTitle>
                        <DialogDescription>Yangi terminalni maktabga biriktirish</DialogDescription>
                    </DialogHeader>
                    <CreateTerminalForm
                        onCancel={() => setCreateOpen(false)}
                        onSaved={() => {
                            setCreateOpen(false);
                            setSuccess("Terminal qo‘shildi.");
                            setPage(1);
                            refresh();
                        }}
                    />
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={action !== null}
                onOpenChange={(open) => { if (!open && !actionBusy) setAction(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {action?.mode === "restore" ? "Terminalni tiklash" : "Terminalni arxivlash"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {action?.terminal.name} (#{action?.terminal.id}) — {action?.terminal.school.name}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p className="text-sm">
                        {action?.mode === "restore"
                            ? "Terminal arxivdan chiqariladi, ammo avtomatik faollashtirilmaydi."
                            : "Terminal arxivlanadi va nofaol holatga o‘tadi. Davomat tarixi saqlanadi."}
                    </p>
                    {actionError && (
                        <p role="alert" className="text-sm text-destructive">{actionError}</p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionBusy}>Bekor qilish</AlertDialogCancel>
                        <Button
                            type="button"
                            disabled={actionBusy}
                            variant={action?.mode === "archive" ? "destructive" : "default"}
                            onClick={() => void confirmArchiveAction()}
                        >
                            {actionBusy ? "Bajarilmoqda..." : action?.mode === "archive" ? "Arxivlash" : "Tiklash"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
