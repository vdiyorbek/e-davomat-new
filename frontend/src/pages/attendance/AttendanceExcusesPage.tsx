
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { AttendanceExcuseActions } from '@/components/attendance/AttendanceExcuseActions';
import { useApiQuery } from '@/hooks/useApiQuery';
import { CreateAttendanceExcuseDialog } from '@/components/attendance/CreateAttendanceExcuseDialog';
import type { School } from '@/types/school';
import {
    EXCUSE_REASON_LABELS,
    type AttendanceExcusesPageResponse,
    type ExcuseStatus,
} from '@/types/attendance-excuse';

interface AppliedFilters {
    schoolId: string;
    personId: string;
    status: string;
}

function formatDate(value: string): string {
    const date = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    return match
        ? `${match[3]}.${match[2]}.${match[1]}`
        : value;
}

export function AttendanceExcusesPage() {
    const [draft, setDraft] = useState<AppliedFilters>({
        schoolId: '',
        personId: '',
        status: 'ACTIVE',
    });

    const [filters, setFilters] = useState<AppliedFilters>(draft);
    const [page, setPage] = useState(1);
    const [filterError, setFilterError] = useState('');

    const { data: schools } = useApiQuery<School[]>('/schools');

    const query = new URLSearchParams({
        page: String(page),
        limit: '20',
    });

    if (filters.schoolId) query.set('schoolId', filters.schoolId);
    if (filters.personId) query.set('personId', filters.personId);
    if (filters.status) query.set('status', filters.status);

    const path = `/attendance-excuses?${query.toString()}`;

    const {
        data,
        loading,
        error,
        retry,
    } = useApiQuery<AttendanceExcusesPageResponse>(path);

    function applyFilters() {
        if (
            draft.personId &&
            (
                !/^[1-9]\d*$/.test(draft.personId) ||
                Number(draft.personId) > 4294967295
            )
        ) {
            setFilterError('O‘quvchi ID noto‘g‘ri.');
            return;
        }

        setFilterError('');
        setPage(1);
        setFilters({ ...draft });
    }

    const totalPages = Math.max(1, data?.totalPages ?? 1);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Davomat boshqaruvi"
                title="Sababli arizalar"
                description="O‘quvchilarning sababli davomat arizalari va asoslovchi hujjatlari."

                actions={
                    <>
                        <CreateAttendanceExcuseDialog
                            onSaved={() => {
                                setPage(1);

                                setDraft((previous) => ({
                                    ...previous,
                                    status: 'ACTIVE',
                                }));

                                setFilters((previous) => ({
                                    ...previous,
                                    status: 'ACTIVE',
                                }));
                                retry();
                            }}
                        />

                        <Button
                            type="button"
                            variant="outline"
                            onClick={retry}
                        >
                            <RefreshCw className="size-4" />
                            Yangilash
                        </Button>
                    </>
                }

            />

            <form
                className="rounded-2xl border border-border bg-card p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    applyFilters();
                }}
            >
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <label
                            htmlFor="excuses-school"
                            className="text-sm font-semibold"
                        >
                            Maktab
                        </label>

                        <select
                            id="excuses-school"
                            value={draft.schoolId}
                            onChange={(event) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    schoolId: event.target.value,
                                }))
                            }
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                            <option value="">Barcha ruxsat etilgan maktablar</option>

                            {(schools ?? []).map((school) => (
                                <option key={school.id} value={school.id}>
                                    {school.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="excuses-person"
                            className="text-sm font-semibold"
                        >
                            O‘quvchi ID (ixtiyoriy)
                        </label>

                        <Input
                            id="excuses-person"
                            type="number"
                            min={1}
                            max={4294967295}
                            step={1}
                            value={draft.personId}
                            placeholder="Masalan: 125"
                            onChange={(event) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    personId: event.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="excuses-status"
                            className="text-sm font-semibold"
                        >
                            Ariza holati
                        </label>

                        <select
                            id="excuses-status"
                            value={draft.status}
                            onChange={(event) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    status: event.target.value,
                                }))
                            }
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                            <option value="">Barcha arizalar</option>
                            <option value="ACTIVE">Faol</option>
                            <option value="CANCELLED">Bekor qilingan</option>
                        </select>
                    </div>
                </div>

                {filterError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                        {filterError}
                    </p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            const empty = {
                                schoolId: '',
                                personId: '',
                                status: 'ACTIVE',
                            };

                            setDraft(empty);
                            setFilters(empty);
                            setPage(1);
                            setFilterError('');
                        }}
                    >
                        Tozalash
                    </Button>

                    <Button type="submit">
                        Ko‘rsatish
                    </Button>
                </div>
            </form>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">
                        Arizalar ro‘yxati
                    </h2>

                    {data && (
                        <span className="text-sm text-muted-foreground">
                            Jami: {data.total} ta
                        </span>
                    )}
                </div>

                {loading ? (
                    <p role="status" className="text-sm text-muted-foreground">
                        Arizalar yuklanmoqda…
                    </p>
                ) : error || !data ? (
                    <div className="space-y-3 rounded-2xl border p-5">
                        <p role="alert" className="text-sm text-destructive">
                            {error || 'Ma’lumotlarni olib bo‘lmadi.'}
                        </p>

                        <Button variant="outline" onClick={retry}>
                            Qayta urinish
                        </Button>
                    </div>
                ) : data.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Tanlangan filtrlar bo‘yicha arizalar topilmadi.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <thead className="border-b bg-muted/60">
                                    <tr className="text-xs font-semibold text-muted-foreground">
                                        <th className="px-4 py-4">№</th>
                                        <th className="px-4 py-4">O‘quvchi</th>
                                        <th className="px-4 py-4">Maktab</th>
                                        <th className="px-4 py-4">Sabab</th>
                                        <th className="px-4 py-4">Sana oralig‘i</th>
                                        <th className="px-4 py-4">Holat</th>
                                        <th className="px-4 py-4 text-right">Amallar</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {data.data.map((item, index) => {
                                        const name = item.person
                                            ? [
                                                item.person.lastName,
                                                item.person.firstName,
                                                item.person.middleName,
                                            ].filter(Boolean).join(' ')
                                            : 'Shaxs topilmadi';

                                        return (
                                            <tr key={item.id} className="hover:bg-muted/30">
                                                <td className="px-4 py-4 tabular-nums">
                                                    {(data.page - 1) * data.limit + index + 1}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <Link
                                                        to={`/persons/${item.personId}`}
                                                        className="font-semibold hover:text-primary hover:underline"
                                                    >
                                                        {name}
                                                    </Link>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Ariza №{item.id}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4">
                                                    {item.school.name}
                                                </td>

                                                <td className="px-4 py-4">
                                                    {EXCUSE_REASON_LABELS[item.reason]}
                                                </td>

                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {formatDate(item.startDate)}
                                                    {' — '}
                                                    {formatDate(item.endDate)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span
                                                        className={
                                                            item.status === 'ACTIVE'
                                                                ? 'rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary'
                                                                : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'
                                                        }
                                                    >
                                                        {item.status === 'ACTIVE'
                                                            ? 'Faol'
                                                            : 'Bekor qilingan'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <AttendanceExcuseActions
                                                        excuseId={item.id}
                                                        status={item.status as ExcuseStatus}
                                                        onChanged={retry}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {data && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                            {data.page} / {totalPages} sahifa
                        </span>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((value) => value - 1)}
                            >
                                <ChevronLeft className="size-4" />
                                Oldingi
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((value) => value + 1)}
                            >
                                Keyingi
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
