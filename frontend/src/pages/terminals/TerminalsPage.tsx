import { SelectField } from "@/components/common/SelectField";
import { schoolScopeOptions } from "@/lib/school-scope";
import type { School } from "@/types/school";
import type { TerminalDirection } from "@/types/terminal";
import { useState } from "react";
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Plus,
    RotateCw,
    ScanFace,
    Settings2,
    Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import {
    EmptyState,
    ErrorState,
    LoadingState,
    SuccessNotice,
} from "@/components/common/states";
import { StatusBadge } from "@/components/common/StatusBadge";

import { CheckTerminalButton } from "@/components/terminals/CheckTerminalButton";
import { CreateTerminalForm } from "@/components/terminals/CreateTerminalForm";
import { StartTerminalSyncForm } from "@/components/terminals/StartTerminalSyncForm";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/date";

import type {
    Terminal,
    TerminalsPageResponse,
} from "@/types/terminal";

function terminalAddress(terminal: Terminal) {
    const host = terminal.host.includes(":")
        ? `[${terminal.host}]`
        : terminal.host;

    return `${terminal.protocol.toLowerCase()}://${host}:${terminal.port}`;
}

function syncTone(terminal: Terminal) {
    if (!terminal.isActive) return "neutral" as const;
    if (terminal.eventsSyncedUntil) return "success" as const;
    if (terminal.syncStartAt) return "warning" as const;
    return "neutral" as const;
}

function TerminalManagementDialog({
    terminal,
    canManage,
    onClose,
    onChanged,
}: {
    terminal: Terminal | null;
    canManage: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const { t } = useTranslation();

    if (!terminal) return null;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {terminal.name} · #{terminal.id}
                    </DialogTitle>
                    <DialogDescription>
                        {terminal.school.name} — terminal ma’lumotlari va
                        boshqaruv amallari
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted-foreground">
                                Terminal manzili
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                                {terminalAddress(terminal)}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Qurilma modeli
                            </dt>
                            <dd className="mt-1 font-medium">
                                {terminal.model || t("terminals.unknown")}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Seriya raqami
                            </dt>
                            <dd className="mt-1 break-all font-mono text-xs">
                                {terminal.serialNumber || "—"}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Oxirgi tekshiruv
                            </dt>
                            <dd className="mt-1">
                                {formatDateTime(
                                    terminal.lastCheckedAt,
                                    t("terminals.never"),
                                )}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Sinxronlash boshlangan
                            </dt>
                            <dd className="mt-1">
                                {formatDateTime(
                                    terminal.syncStartAt,
                                    t("common.notSet"),
                                )}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Eventlar sinxronlangan vaqtgacha
                            </dt>
                            <dd className="mt-1">
                                {formatDateTime(
                                    terminal.eventsSyncedUntil,
                                    t("terminals.never"),
                                )}
                            </dd>
                        </div>

                        <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">
                                Oxirgi muvaffaqiyatli sinxronlash
                            </dt>
                            <dd className="mt-1">
                                {formatDateTime(
                                    terminal.lastSuccessfulSyncAt,
                                    t("terminals.never"),
                                )}
                            </dd>
                        </div>
                    </dl>

                    {canManage && (
                        <div className="space-y-4 border-t pt-4">
                            <h3 className="font-semibold">
                                Terminalni boshqarish
                            </h3>

                            <CheckTerminalButton
                                terminalId={terminal.id}
                            />

                            {!terminal.syncStartAt && (
                                <StartTerminalSyncForm
                                    terminalId={terminal.id}
                                    isActive={terminal.isActive}
                                    onStarted={() => {
                                        onChanged();
                                        onClose();
                                    }}
                                />
                            )}

                            {terminal.syncStartAt && (
                                <p className="text-sm text-muted-foreground">
                                    Ushbu terminalda sinxronlash
                                    boshlanish vaqti sozlangan.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TerminalsTable({
    page,
    limit,
    search,
    regionId,
    districtId,
    schoolId,
    direction,
    onPageChange,
    onLimitChange,
}: {
    page: number;
    limit: number;
    search: string;
    regionId: string;
    districtId: string;
    schoolId: string;
    direction: TerminalDirection | "";
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}) {
    const { t } = useTranslation();
    const { session } = useAuth();

    const canManage =
        session?.profile.role === "SUPER_ADMIN";

    const [selectedTerminal, setSelectedTerminal] =
        useState<Terminal | null>(null);

    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (schoolId) params.set("schoolId", schoolId);
    if (direction) params.set("direction", direction);
    if (search.trim()) {
        params.set("search", search.trim());
    }

    const path = `/terminals?${params.toString()}`;

    const { data, loading, error, retry } =
        useApiQuery<TerminalsPageResponse>(path);

    if (loading) {
        return <LoadingState label={t("terminals.loading")} />;
    }

    if (error || !data) {
        return (
            <ErrorState
                message={error || t("common.loadFailed")}
                onRetry={retry}
            />
        );
    }

    if (data.data.length === 0) {
        return (
            <EmptyState
                icon={ScanFace}
                title={t("terminals.emptyTitle")}
                description={t("terminals.empty")}
                action={
                    page > 1 ? (
                        <Button
                            variant="outline"
                            onClick={() => onPageChange(1)}
                        >
                            Birinchi sahifaga
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    return (
        <div className="space-y-4">
            <Card className="min-w-0 gap-0">
                <CardContent className="min-w-0 space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                                <ScanFace aria-hidden="true" className="size-5" />
                            </div>

                            <div>
                                <p className="font-semibold">
                                    Terminallar ro‘yxati
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Jami: {data.total.toLocaleString("uz-UZ")} ta
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                    Qatorlar:
                                </span>

                                <select
                                    value={limit}
                                    onChange={(event) => {
                                        onLimitChange(Number(event.target.value));
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-2"
                                    aria-label="Sahifadagi qatorlar soni"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </label>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={retry}
                            >
                                <RotateCw aria-hidden="true" />
                                Yangilash
                            </Button>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
                            <thead className="bg-muted/60">
                                <tr className="text-xs text-muted-foreground">
                                    <th className="px-3 py-3 font-semibold">
                                        ID
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Terminal nomi
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Maktab / Hudud
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        IP / Port
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Yo‘nalish
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Holat
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Model
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Oxirgi tekshiruv
                                    </th>
                                    <th className="px-3 py-3 font-semibold">
                                        Sinxronlash
                                    </th>
                                    <th className="px-3 py-3 text-right font-semibold">
                                        Amallar
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {data.data.map((terminal) => {
                                    const DirectionIcon =
                                        terminal.direction === "IN"
                                            ? ArrowDownToLine
                                            : ArrowUpFromLine;

                                    const syncText =
                                        !terminal.syncStartAt
                                            ? t("terminals.syncState.notStarted")
                                            : !terminal.isActive
                                                ? t("terminals.syncState.disabled")
                                                : terminal.eventsSyncedUntil
                                                    ? t("terminals.syncState.running")
                                                    : t("terminals.syncState.pending");

                                    return (
                                        <tr
                                            key={terminal.id}
                                            className="border-t transition-colors hover:bg-muted/30"
                                        >
                                            <td className="px-3 py-3 font-mono text-xs tabular-nums">
                                                {terminal.id}
                                            </td>

                                            <td className="px-3 py-3">
                                                <div className="font-semibold">
                                                    {terminal.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {terminal.protocol}
                                                </div>
                                            </td>

                                            <td className="px-3 py-3">
                                                <p className="font-medium">
                                                    {terminal.school.name}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {terminal.school.region.name}
                                                    {" / "}
                                                    {terminal.school.district.name}
                                                </p>
                                            </td>

                                            <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                                                <div>
                                                    {terminal.host}
                                                    <span className="text-muted-foreground">
                                                        :{terminal.port}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-muted-foreground">
                                                    {terminal.username}
                                                </p>
                                            </td>

                                            <td className="px-3 py-3">
                                                <StatusBadge tone="info" dot={false}>
                                                    <DirectionIcon
                                                        aria-hidden="true"
                                                        className="size-3.5"
                                                    />
                                                    {t(
                                                        `terminals.directions.${terminal.direction}`,
                                                    )}
                                                </StatusBadge>
                                            </td>

                                            <td className="px-3 py-3">
                                                <StatusBadge
                                                    tone={
                                                        terminal.isActive
                                                            ? "success"
                                                            : "neutral"
                                                    }
                                                >
                                                    {terminal.isActive
                                                        ? t("terminals.active")
                                                        : t("terminals.inactive")}
                                                </StatusBadge>
                                            </td>

                                            <td className="px-3 py-3 text-xs">
                                                {terminal.model ||
                                                    t("terminals.unknown")}
                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap tabular-nums">
                                                {formatDateTime(
                                                    terminal.lastCheckedAt,
                                                    t("terminals.never"),
                                                )}
                                            </td>

                                            <td className="px-3 py-3">
                                                <StatusBadge
                                                    tone={syncTone(terminal)}
                                                    className="h-auto max-w-48 whitespace-normal"
                                                >
                                                    {syncText}
                                                </StatusBadge>

                                                {terminal.eventsSyncedUntil && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {formatDateTime(
                                                            terminal.eventsSyncedUntil,
                                                            t("terminals.never"),
                                                        )}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-right">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setSelectedTerminal(terminal)
                                                    }
                                                >
                                                    <Settings2
                                                        aria-hidden="true"
                                                        className="size-4"
                                                    />
                                                    Boshqarish
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        page={data.page}
                        totalPages={Math.max(1, data.totalPages)}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.data.length}
                        onPageChange={onPageChange}
                    />
                </CardContent>
            </Card>

            <TerminalManagementDialog
                terminal={selectedTerminal}
                canManage={canManage}
                onClose={() => setSelectedTerminal(null)}
                onChanged={retry}
            />
        </div>
    );
}

export function TerminalsPage() {
    const { t } = useTranslation();
    const { session } = useAuth();

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [regionId, setRegionId] = useState("");
    const [districtId, setDistrictId] = useState("");
    const [schoolId, setSchoolId] = useState("");
    const [direction, setDirection] =
        useState<TerminalDirection | "">("");

    const { data: schools } = useApiQuery<School[]>("/schools");

    const scope = schoolScopeOptions(
        schools,
        regionId,
        districtId,
    );

    const role = session?.profile.role;

    const canSelectRegion = role === "SUPER_ADMIN";

    const canSelectDistrict =
        role === "SUPER_ADMIN" ||
        role === "REGION_ADMIN";

    const canSelectSchool =
        canSelectDistrict ||
        role === "DISTRICT_ADMIN";

    function changeRegion(value: string) {
        setRegionId(value);
        setDistrictId("");
        setSchoolId("");
        setPage(1);
    }

    function changeDistrict(value: string) {
        setDistrictId(value);
        setSchoolId("");
        setPage(1);
    }

    function changeSchool(value: string) {
        setSchoolId(value);
        setPage(1);
    }

    function changeDirection(value: string) {
        if (value !== "" && value !== "IN" && value !== "OUT") {
            return;
        }

        setDirection(value);
        setPage(1);
    }
    function applySearch() {
        setSearch(searchInput.trim());
        setPage(1);
    }

    function clearSearch() {
        setSearchInput("");
        setSearch("");
        setPage(1);
    }
    const [showCreate, setShowCreate] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [success, setSuccess] = useState("");

    const canCreate =
        session?.profile.role === "SUPER_ADMIN";

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t("nav.groups.system")}
                title={t("terminals.title")}
                description={t("terminals.subtitle")}
                actions={
                    canCreate ? (
                        <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setSuccess("");
                                setShowCreate(true);
                            }}
                        >
                            <Plus aria-hidden="true" />
                            {t("terminals.add")}
                        </Button>
                    ) : undefined
                }
            />

            {success && <SuccessNotice>{success}</SuccessNotice>}
            <Card>
                <CardContent className="p-4">
                    <form
                        className="flex flex-col gap-3 sm:flex-row"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applySearch();
                        }}
                    >
                        <div className="relative min-w-0 flex-1">
                            <Search
                                aria-hidden="true"
                                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            />

                            <Input
                                value={searchInput}
                                onChange={(event) =>
                                    setSearchInput(event.target.value)
                                }
                                placeholder="Terminal nomi, IP, model, maktab yoki ID..."
                                aria-label="Terminallarni qidirish"
                                className="pl-10"
                            />
                        </div>

                        <Button type="submit">
                            <Search aria-hidden="true" />
                            Qidirish
                        </Button>

                        {(search || searchInput) && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={clearSearch}
                            >
                                Tozalash
                            </Button>
                        )}
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        {canSelectRegion && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Viloyat
                                </label>

                                <SelectField
                                    value={regionId}
                                    onValueChange={changeRegion}
                                    emptyOption="Barcha viloyatlar"
                                    options={scope.regions}
                                    searchable
                                />
                            </div>
                        )}

                        {canSelectDistrict && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Tuman
                                </label>

                                <SelectField
                                    value={districtId}
                                    onValueChange={changeDistrict}
                                    emptyOption="Barcha tumanlar"
                                    options={scope.districts}
                                    searchable
                                />
                            </div>
                        )}

                        {canSelectSchool && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Maktab
                                </label>

                                <SelectField
                                    value={schoolId}
                                    onValueChange={changeSchool}
                                    emptyOption="Barcha maktablar"
                                    options={scope.schools}
                                    searchable
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Terminal yo‘nalishi
                            </label>

                            <SelectField
                                value={direction}
                                onValueChange={changeDirection}
                                emptyOption="Barcha yo‘nalishlar"
                                options={[
                                    { value: "IN", label: "Kirish" },
                                    { value: "OUT", label: "Chiqish" },
                                ]}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <TerminalsTable
                key={`${page}-${limit}-${search}-${regionId}-${districtId}-${schoolId}-${direction}-${refreshVersion}`}
                page={page}
                limit={limit}
                search={search}
                regionId={regionId}
                districtId={districtId}
                schoolId={schoolId}
                direction={direction}
                onPageChange={setPage}
                onLimitChange={(nextLimit) => {
                    setLimit(nextLimit);
                    setPage(1);
                }}
            />

            {canCreate && (
                <Dialog
                    open={showCreate}
                    onOpenChange={setShowCreate}
                >
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {t("terminals.form.title")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("terminals.form.description")}
                            </DialogDescription>
                        </DialogHeader>

                        <CreateTerminalForm
                            onCancel={() => setShowCreate(false)}
                            onSaved={() => {
                                setShowCreate(false);
                                setSuccess(t("terminals.saved"));
                                setPage(1);
                                setRefreshVersion(
                                    (value) => value + 1,
                                );
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
