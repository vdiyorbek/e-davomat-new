import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CreateTerminalForm } from '@/components/terminals/CreateTerminalForm';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import type { TerminalsPageResponse } from '@/types/terminal';
import { CheckTerminalButton } from '@/components/terminals/CheckTerminalButton';
import { StartTerminalSyncForm } from '@/components/terminals/StartTerminalSyncForm';

function formatDateTime(value: string | null): string {
    if (!value) return 'Hali bajarilmagan';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Sana noma’lum';

    return new Intl.DateTimeFormat('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

function TerminalsResults({
    page,
    onPageChange,
}: {
    page: number;
    onPageChange: (page: number) => void;
}) {
    const { data, loading, error, retry } =
        useApiQuery<TerminalsPageResponse>(
            `/terminals?page=${page}&limit=12`,
        );
    const { session } = useAuth();
    const canCheck = session?.profile.role === 'SUPER_ADMIN';

    if (loading) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                Terminallar yuklanmoqda…
            </p>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-3">
                <p role="alert" className="text-sm text-destructive">
                    {error || 'Ma’lumotlarni olib bo‘lmadi.'}
                </p>

                <Button variant="outline" onClick={retry}>
                    Qayta urinish
                </Button>
            </div>
        );
    }

    if (data.data.length === 0) {
        return (
            <div className="space-y-3 rounded-2xl border p-6">
                <p className="text-sm text-muted-foreground">
                    Bu sahifada terminallar mavjud emas.
                </p>

                {page > 1 && (
                    <Button
                        variant="outline"
                        onClick={() => onPageChange(1)}
                    >
                        Birinchi sahifaga
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Jami: {data.total} ta terminal
                </p>

                <Button variant="outline" onClick={retry}>
                    Yangilash
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.data.map((terminal) => (
                    <article
                        key={terminal.id}
                        className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="min-w-0 break-words font-semibold">
                                {terminal.name}
                            </h2>

                            <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                                {terminal.direction === 'IN'
                                    ? 'Kirish'
                                    : 'Chiqish'}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <p className="break-words text-sm font-medium">
                                {terminal.school.name}
                            </p>

                            <p className="break-words text-xs text-muted-foreground">
                                {terminal.school.region.name}
                                {' / '}
                                {terminal.school.district.name}
                            </p>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Sinxronlash boshlanish sanasi
                            </dt>
                            <dd>
                                {terminal.syncStartAt
                                    ? formatDateTime(terminal.syncStartAt)
                                    : 'Belgilanmagan'}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-muted-foreground">
                                Shu vaqtgacha eventlar tekshirilgan
                            </dt>
                            <dd>
                                {formatDateTime(terminal.eventsSyncedUntil)}
                            </dd>
                        </div>

                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground">
                                    Terminal manzili
                                </dt>

                                <dd className="mt-1 break-all font-mono text-xs">
                                    {terminal.protocol.toLowerCase()}://
                                    {terminal.host.includes(':')
                                        ? `[${terminal.host}]`
                                        : terminal.host}
                                    :{terminal.port}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Sozlamadagi holati
                                </dt>
                                <dd>
                                    {terminal.isActive
                                        ? 'Faol'
                                        : 'O‘chirilgan'}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Model
                                </dt>
                                <dd>{terminal.model || 'Aniqlanmagan'}</dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Oxirgi tekshiruv
                                </dt>
                                <dd>
                                    {formatDateTime(terminal.lastCheckedAt)}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Oxirgi muvaffaqiyatli sinxronlash
                                </dt>
                                <dd>
                                    {formatDateTime(
                                        terminal.lastSuccessfulSyncAt,
                                    )}
                                </dd>
                            </div>
                        </dl>
                        <div className="space-y-3">
                            {canCheck && (
                                <CheckTerminalButton terminalId={terminal.id} />
                            )}

                            {terminal.syncStartAt ? (
                                <p
                                    role="status"
                                    className="rounded-xl border bg-muted/30 p-3 text-sm"
                                >
                                    {!terminal.isActive
                                        ? 'Terminal o‘chirilgan. Yangi sinxronlash vazifalari qo‘shilmaydi.'
                                        : terminal.eventsSyncedUntil
                                            ? 'Avtomatik sinxronlash yoqilgan.'
                                            : 'Boshlanish vaqti saqlangan. Birinchi oraliq hali yakunlanmagan.'}
                                </p>
                            ) : canCheck && terminal.syncStartAt === null ? (
                                <StartTerminalSyncForm
                                    terminalId={terminal.id}
                                    isActive={terminal.isActive}
                                    onStarted={retry}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {terminal.syncStartAt === null
                                        ? 'Avtomatik sinxronlash boshlanmagan.'
                                        : 'Sinxronlash ma’lumoti API javobida kelmadi.'}
                                </p>
                            )}
                        </div>
                    </article>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {data.page} / {data.totalPages} sahifa
                </p>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                    >
                        Oldingi
                    </Button>

                    <Button
                        variant="outline"
                        disabled={page >= data.totalPages}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Keyingi
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function TerminalsPage() {
    const { session } = useAuth();

    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [success, setSuccess] = useState('');

    const canCreate = session?.profile.role === 'SUPER_ADMIN';

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Boshqaruv"
                title="Terminallar"
                description="Maktablardagi kirish va chiqish Face-ID terminallarini boshqarish."
                actions={
                    canCreate && !showCreate ? (
                        <Button
                            type="button"
                            onClick={() => {
                                setSuccess('');
                                setShowCreate(true);
                            }}
                        >
                            <Plus className="size-4" />
                            Terminal qo‘shish
                        </Button>
                    ) : undefined
                }
            />

            {success && (
                <p
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
                >
                    {success}
                </p>
            )}

            {canCreate && showCreate && (
                <CreateTerminalForm
                    onCancel={() => setShowCreate(false)}
                    onSaved={() => {
                        setShowCreate(false);
                        setSuccess('Terminal saqlandi.');
                        setPage(1);
                        setRefreshVersion((value) => value + 1);
                    }}
                />
            )}

            <TerminalsResults
                key={`${page}-${refreshVersion}`}
                page={page}
                onPageChange={setPage}
            />
        </div>
    );
}