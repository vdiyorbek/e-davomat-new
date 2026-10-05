
import {
    AlertCircle,
    BookOpen,
    Building2,
    CalendarDays,
    GraduationCap,
    MapPin,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { MySchool } from '@/types/school';

function formatDate(value: string | null | undefined): string {
    if (!value) return 'Belgilanmagan';
    // DATE qiymatini vaqt zonasiga aylantirmaymiz.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function SchoolCard({ item }: { item: MySchool }) {
    const isStudent = item.type === 'STUDENT';
    const roleName = isStudent
        ? 'O‘quvchi'
        : item.type === 'TEACHER' ? 'O‘qituvchi' : item.type;
    const RoleIcon = isStudent ? GraduationCap : BookOpen;

    return (
        <Card className="h-full min-w-0 gap-5 rounded-2xl">
            <CardHeader className="gap-4 px-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Building2 aria-hidden="true" className="size-5" />
                    </div>
                    <span className={
                        'inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ' +
                        (isStudent
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'bg-violet-500/10 text-violet-700 dark:text-violet-300')
                    }>
                        <RoleIcon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{roleName}</span>
                    </span>
                </div>
                <CardTitle className="text-base leading-7 [overflow-wrap:anywhere] sm:text-lg">
                    {item.school.name}
                </CardTitle>
                <div className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p>{item.school.region.name}</p>
                        <p>{item.school.district.name}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="mt-auto space-y-4 px-5 sm:px-6">
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        {isStudent ? 'O‘qish davri' : 'Faoliyat davri'}
                    </div>
                    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <div className="min-w-0">
                            <dt className="text-xs leading-5 text-muted-foreground">Boshlanish sanasi</dt>
                            <dd className="mt-1 text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                                {formatDate(item.startDate)}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-xs leading-5 text-muted-foreground">Faollik tugaydigan sana</dt>
                            <dd className="mt-1 text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                                {formatDate(item.endDate)}
                            </dd>
                        </div>
                    </dl>
                </div>
                {item.endDate && (
                    <p className="text-xs leading-5 text-muted-foreground">
                        Tugash sanasi — ushbu biriktirish faol bo‘lmaydigan birinchi kun.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function LoadingCards() {
    return (
        <div role="status" aria-live="polite">
            <span className="sr-only">Maktablar yuklanmoqda…</span>
            <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:gap-6">
                {[0, 1].map((index) => (
                    <div key={index} className="space-y-5 rounded-2xl border bg-card p-5 motion-safe:animate-pulse sm:p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="size-11 rounded-xl bg-muted" />
                            <div className="h-7 w-24 rounded-lg bg-muted" />
                        </div>
                        <div className="h-5 w-3/4 rounded bg-muted" />
                        <div className="space-y-2">
                            <div className="h-4 w-2/3 rounded bg-muted" />
                            <div className="h-4 w-1/2 rounded bg-muted" />
                        </div>
                        <div className="h-28 rounded-xl bg-muted" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MySchoolsPage() {
    const { data, loading, error, retry } = useApiQuery<MySchool[]>('/me/schools');
    const items = data ?? [];

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Mening maktablarim</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Barcha davrlardagi o‘qish va ish joylaringiz.
                    </p>
                </div>
                {!loading && !error && (
                    <span className="w-fit shrink-0 rounded-lg border bg-background px-3 py-2 text-xs font-medium tabular-nums">
                        {items.length} ta biriktirish
                    </span>
                )}
            </div>

            {loading ? (
                <LoadingCards />
            ) : error ? (
                <div role="alert" className="rounded-2xl border border-destructive/30 bg-background p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                        <div className="min-w-0">
                            <h2 className="font-semibold">Ma’lumotlarni yuklab bo‘lmadi</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={retry} className="mt-5 min-h-11 w-full sm:w-auto">
                        <RefreshCw aria-hidden="true" className="size-4" />
                        Qayta urinish
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-background px-5 py-12 text-center sm:px-8 sm:py-16">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Building2 aria-hidden="true" className="size-7" />
                    </div>
                    <h2 className="mt-5 text-base font-semibold">Hali maktab biriktirilmagan</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        Maktabga biriktirilganingizdan so‘ng, o‘qish yoki ish joyingiz shu yerda ko‘rinadi.
                        Ma’lumot yetishmayotgan bo‘lsa, maktab administratoriga murojaat qiling.
                    </p>
                </div>
            ) : (
                <ul aria-label="Maktablarga biriktirishlar" className="grid min-w-0 list-none gap-4 md:grid-cols-2 xl:gap-6">
                    {items.map((item) => (
                        <li key={item.membershipId} className="min-w-0">
                            <SchoolCard item={item} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}