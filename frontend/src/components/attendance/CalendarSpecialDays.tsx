
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import {
    authorizedPatch,
    authorizedPost,
} from '@/lib/auth-session';

import type { School } from '@/types/school';

type DayType = 'DAY_OFF' | 'WORK_DAY';
type AppliesTo = 'STUDENT' | 'TEACHER' | 'BOTH';
type ScopeType = 'GLOBAL' | 'REGION' | 'DISTRICT' | 'SCHOOL';

interface CalendarRule {
    id: number;
    startDate: string;
    endDate: string;
    dayType: DayType;
    appliesTo: AppliesTo;
    scopeType: ScopeType;
    regionId: number | null;
    districtId: number | null;
    schoolId: number | null;
    classId: number | null;
    isMandatory: boolean;
    isActive: boolean;
    reason: string;
}

interface Props {
    school: School;
    academicYear: string;
}

const inputStyle =
    'h-11 w-full rounded-xl border border-input ' +
    'bg-background px-3 text-sm';

const scopeLabels: Record<ScopeType, string> = {
    GLOBAL: 'Respublika',
    REGION: 'Viloyat',
    DISTRICT: 'Tuman',
    SCHOOL: 'Maktab',
};

const audienceLabels: Record<AppliesTo, string> = {
    STUDENT: 'O‘quvchilar',
    TEACHER: 'O‘qituvchilar',
    BOTH: 'Barchasi',
};

export function CalendarSpecialDays({
    school,
    academicYear,
}: Props) {
    const { session } = useAuth();
    const profile = session?.profile;

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

    const yearStart = `${academicYear.slice(0, 4)}-09-01`;
    const yearEnd = `${academicYear.slice(5)}-08-31`;

    const [startDate, setStartDate] = useState(yearStart);
    const [endDate, setEndDate] = useState(yearStart);
    const [dayType, setDayType] = useState<DayType>('DAY_OFF');
    const [appliesTo, setAppliesTo] = useState<AppliesTo>('STUDENT');
    const [scopeType, setScopeType] = useState<'SCHOOL' | 'GLOBAL'>(
        'SCHOOL',
    );
    const [isMandatory, setIsMandatory] = useState(false);
    const [reason, setReason] = useState('');

    const [busy, setBusy] = useState(false);
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const saving = useRef(false);

    const params = new URLSearchParams({
        schoolId: String(school.id),
        startDate: yearStart,
        endDate: yearEnd,
    });

    const query = useApiQuery<CalendarRule[]>(
        `/attendance-calendar/rules?${params.toString()}`,
    );

    function canCancel(rule: CalendarRule): boolean {
        if (!profile) return false;

        if (profile.role === 'SUPER_ADMIN') return true;

        if (rule.scopeType === 'GLOBAL') return false;

        if (profile.role === 'REGION_ADMIN') {
            if (rule.scopeType === 'REGION') {
                return rule.regionId === profile.regionId;
            }

            if (rule.scopeType === 'DISTRICT') {
                return (
                    rule.districtId === school.districtId &&
                    school.district.regionId === profile.regionId
                );
            }

            return (
                rule.schoolId === school.id &&
                school.district.regionId === profile.regionId
            );
        }

        if (profile.role === 'DISTRICT_ADMIN') {
            if (rule.scopeType === 'REGION') return false;

            return (
                school.districtId === profile.districtId &&
                (
                    rule.districtId === profile.districtId ||
                    rule.schoolId === school.id
                )
            );
        }

        return (
            profile.role === 'SCHOOL_ADMIN' &&
            rule.scopeType === 'SCHOOL' &&
            rule.schoolId === profile.schoolId
        );
    }

    async function handleCreate(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (saving.current) return;

        setError('');
        setSuccess('');

        if (
            !startDate ||
            !endDate ||
            startDate < yearStart ||
            endDate > yearEnd ||
            endDate < startDate
        ) {
            setError('Sana oralig‘ini tekshiring.');
            return;
        }

        if (reason.trim().length < 3) {
            setError('Sababni kamida 3 ta belgi bilan kiriting.');
            return;
        }

        saving.current = true;
        setBusy(true);

        try {
            await authorizedPost(
                '/attendance-calendar/rules',
                {
                    startDate,
                    endDate,
                    dayType,
                    appliesTo,
                    scopeType,
                    ...(scopeType === 'SCHOOL'
                        ? { schoolId: school.id }
                        : { isMandatory }),
                    reason: reason.trim(),
                },
            );

            setSuccess('Maxsus kun qoidasi yaratildi.');
            setReason('');
            query.retry();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Qoidani yaratishda xatolik yuz berdi.',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    async function handleCancel(rule: CalendarRule) {
        if (cancellingId !== null || !canCancel(rule)) return;

        const confirmed = window.confirm(
            `"${rule.reason}" qoidasini bekor qilasizmi?`,
        );

        if (!confirmed) return;

        setError('');
        setSuccess('');
        setCancellingId(rule.id);

        try {
            await authorizedPatch(
                `/attendance-calendar/rules/${rule.id}/cancel`,
                {},
            );

            setSuccess('Qoida bekor qilindi.');
            query.retry();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Qoidani bekor qilib bo‘lmadi.',
            );
        } finally {
            setCancellingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleCreate}
                className="space-y-5 rounded-2xl border bg-card p-5"
            >
                <div>
                    <h2 className="text-lg font-semibold">
                        Maxsus kun yaratish
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Bayram, ta’til yoki qo‘shimcha o‘quv kunini belgilang.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm font-medium">
                        Kun turi
                        <select
                            value={dayType}
                            onChange={(event) =>
                                setDayType(event.target.value as DayType)
                            }
                            disabled={busy}
                            className={inputStyle}
                        >
                            <option value="DAY_OFF">Dam olish kuni</option>
                            <option value="WORK_DAY">O‘quv / ish kuni</option>
                        </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium">
                        Kimlar uchun?
                        <select
                            value={appliesTo}
                            onChange={(event) =>
                                setAppliesTo(event.target.value as AppliesTo)
                            }
                            disabled={busy}
                            className={inputStyle}
                        >
                            <option value="STUDENT">O‘quvchilar</option>
                            <option value="TEACHER">O‘qituvchilar</option>
                            <option value="BOTH">Barchasi</option>
                        </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium">
                        Qoida hududi
                        <select
                            value={scopeType}
                            onChange={(event) => {
                                setScopeType(
                                    event.target.value as 'SCHOOL' | 'GLOBAL',
                                );
                                setIsMandatory(false);
                            }}
                            disabled={busy}
                            className={inputStyle}
                        >
                            <option value="SCHOOL">
                                Ushbu maktab
                            </option>
                            {isSuperAdmin && (
                                <option value="GLOBAL">
                                    Respublika bo‘yicha
                                </option>
                            )}
                        </select>
                    </label>
                </div>

                {scopeType === 'GLOBAL' && isSuperAdmin && (
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={isMandatory}
                            disabled={busy}
                            onChange={(event) =>
                                setIsMandatory(event.target.checked)
                            }
                        />
                        Majburiy respublika qoidasi
                    </label>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                        Boshlanish sanasi
                        <Input
                            type="date"
                            value={startDate}
                            min={yearStart}
                            max={yearEnd}
                            disabled={busy}
                            required
                            onChange={(event) => {
                                const next = event.target.value;
                                setStartDate(next);
                                if (endDate < next) setEndDate(next);
                            }}
                        />
                    </label>

                    <label className="space-y-2 text-sm font-medium">
                        Tugash sanasi
                        <Input
                            type="date"
                            value={endDate}
                            min={startDate}
                            max={yearEnd}
                            disabled={busy}
                            required
                            onChange={(event) =>
                                setEndDate(event.target.value)
                            }
                        />
                    </label>
                </div>

                <label className="block space-y-2 text-sm font-medium">
                    Sabab
                    <Input
                        value={reason}
                        onChange={(event) =>
                            setReason(event.target.value)
                        }
                        maxLength={500}
                        placeholder="Masalan: Kuzgi ta’til"
                        disabled={busy}
                        required
                    />
                </label>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {success && (
                    <p role="status" className="text-sm text-green-600">
                        {success}
                    </p>
                )}

                <Button type="submit" disabled={busy}>
                    {busy ? 'Saqlanmoqda…' : 'Maxsus kunni saqlash'}
                </Button>
            </form>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                        Maxsus kunlar ro‘yxati
                    </h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={query.retry}
                    >
                        <RefreshCw className="size-4" />
                        Yangilash
                    </Button>
                </div>

                {query.loading ? (
                    <p className="text-sm text-muted-foreground">
                        Qoidalar yuklanmoqda…
                    </p>
                ) : query.error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {query.error}
                    </p>
                ) : query.data?.length ? (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">Sana</th>
                                    <th className="px-4 py-3">Kun turi</th>
                                    <th className="px-4 py-3">Kimlar uchun</th>
                                    <th className="px-4 py-3">Hudud</th>
                                    <th className="px-4 py-3">Sabab</th>
                                    <th className="px-4 py-3">Amal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {query.data.map((rule) => (
                                    <tr key={rule.id} className="border-t">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {rule.startDate}
                                            {' — '}
                                            {rule.endDate}
                                        </td>
                                        <td className="px-4 py-3">
                                            {rule.dayType === 'DAY_OFF'
                                                ? 'Dam olish'
                                                : 'Ish / o‘quv kuni'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {audienceLabels[rule.appliesTo]}
                                        </td>
                                        <td className="px-4 py-3">
                                            {scopeLabels[rule.scopeType]}
                                            {rule.classId !== null && (
                                                <span>
                                                    {' · Sinf ID: '}
                                                    {rule.classId}
                                                </span>
                                            )}
                                            {rule.isMandatory && (
                                                <span className="block text-xs">
                                                    Majburiy
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {rule.reason}
                                        </td>
                                        <td className="px-4 py-3">
                                            {canCancel(rule) ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        cancellingId !== null
                                                    }
                                                    onClick={() =>
                                                        void handleCancel(rule)
                                                    }
                                                >
                                                    {cancellingId === rule.id
                                                        ? 'Bekor qilinmoqda…'
                                                        : 'Bekor qilish'}
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    Faqat ko‘rish
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                        Tanlangan o‘quv yilida maxsus kunlar yo‘q.
                    </p>
                )}
            </section>
        </div>
    );
}
