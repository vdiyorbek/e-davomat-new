
import { useMemo, useState } from 'react';
import {
    BookOpen,
    GraduationCap,
    RefreshCw,
    School,
    Search,
    NotebookPen
} from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from '@/components/common/states';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useApiQuery } from '@/hooks/useApiQuery';

interface TeacherAssignment {
    id: number;
    teacherMembershipId: number;

    school: {
        id: number;
        name: string;
    };

    class: {
        id: number;
        name: string;
        academicYear: string;
        gradeLevel: number | null;
    };

    subject: {
        id: number;
        nameUz: string;
    };

    startDate: string;
    endDate: string | null;
}

export function TeacherDashboardPage() {
    const [search, setSearch] = useState('');
    const [academicYear, setAcademicYear] = useState('ALL');

    const assignmentsQuery = useApiQuery<TeacherAssignment[]>(
        '/teacher/me/assignments',
    );

    const assignments = assignmentsQuery.data ?? [];

    const academicYears = useMemo(
        () =>
            [...new Set(
                assignments.map((item) => item.class.academicYear),
            )].sort().reverse(),
        [assignments],
    );

    const statistics = useMemo(() => ({
        schools: new Set(
            assignments.map((item) => item.school.id),
        ).size,

        classes: new Set(
            assignments.map(
                (item) => `${item.school.id}:${item.class.id}`,
            ),
        ).size,

        subjects: new Set(
            assignments.map((item) => item.subject.id),
        ).size,
    }), [assignments]);

    const filteredAssignments = useMemo(() => {
        const keyword = search.trim().toLocaleLowerCase();

        return assignments.filter((item) => {
            if (
                academicYear !== 'ALL' &&
                item.class.academicYear !== academicYear
            ) {
                return false;
            }

            if (!keyword) return true;

            const searchable = [
                item.school.name,
                item.class.name,
                item.subject.nameUz,
                item.class.academicYear,
            ].join(' ').toLocaleLowerCase();

            return searchable.includes(keyword);
        });
    }, [assignments, search, academicYear]);

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="O‘qituvchi kabineti"
                title="Mening fanlarim va sinflarim"
                description="Sizga biriktirilgan fanlar, sinflar va maktablar"
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={assignmentsQuery.retry}
                        disabled={assignmentsQuery.loading}
                    >
                        <RefreshCw aria-hidden="true" />
                        Yangilash
                    </Button>
                }
            />

            {assignmentsQuery.loading && (
                <LoadingState rows={5} />
            )}

            {assignmentsQuery.error && (
                <ErrorState
                    message={assignmentsQuery.error}
                    onRetry={assignmentsQuery.retry}
                />
            )}

            {!assignmentsQuery.loading &&
                !assignmentsQuery.error && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Card>
                                <CardContent className="flex items-center gap-4 p-5">
                                    <School className="size-8 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Maktablar
                                        </p>
                                        <p className="text-2xl font-bold">
                                            {statistics.schools}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="flex items-center gap-4 p-5">
                                    <GraduationCap className="size-8 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Sinflar
                                        </p>
                                        <p className="text-2xl font-bold">
                                            {statistics.classes}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="flex items-center gap-4 p-5">
                                    <BookOpen className="size-8 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Fanlar
                                        </p>
                                        <p className="text-2xl font-bold">
                                            {statistics.subjects}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Fan va sinflarni qidirish
                                </CardTitle>

                            </CardHeader>

                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="relative">
                                    <Search
                                        aria-hidden="true"
                                        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        aria-label="Fan, sinf yoki maktabni qidirish"
                                        className="pl-9"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Fan, sinf yoki maktab..."
                                    />

                                </div>

                                <select
                                    aria-label="O‘quv yilini tanlash"
                                    value={academicYear}
                                    onChange={(event) =>
                                        setAcademicYear(event.target.value)
                                    }
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="ALL">
                                        Barcha o‘quv yillari
                                    </option>
                                    {academicYears.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </CardContent>
                        </Card>

                        {filteredAssignments.length === 0 ? (
                            <EmptyState
                                icon={BookOpen}
                                title={
                                    assignments.length === 0
                                        ? 'Sizga hali fan va sinf biriktirilmagan'
                                        : 'Qidiruv bo‘yicha natija topilmadi'
                                }
                                description={
                                    assignments.length === 0
                                        ? 'Maktab administratori fan va sinf biriktirgandan keyin ular shu yerda paydo bo‘ladi.'
                                        : 'Qidiruv yoki o‘quv yili filtrini o‘zgartiring.'
                                }
                            />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {filteredAssignments.map((item) => (
                                    <Card key={item.id} className="h-full">
                                        <CardHeader>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <CardTitle className="text-lg">
                                                    {item.class.name} sinf
                                                </CardTitle>

                                                <span className="rounded-md bg-muted px-2 py-1 text-xs">
                                                    {item.class.academicYear}
                                                </span>
                                            </div>

                                            <p className="text-sm text-muted-foreground">
                                                {item.school.name}
                                            </p>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                                                <BookOpen
                                                    aria-hidden="true"
                                                    className="size-5 shrink-0 text-muted-foreground"
                                                />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Fan
                                                    </p>
                                                    <p className="font-semibold">
                                                        {item.subject.nameUz}
                                                    </p>
                                                </div>
                                                <Button asChild className="w-full">
                                                    <Link to={`/teacher/journal/${item.id}`}>
                                                        <NotebookPen aria-hidden="true" />
                                                        Elektron jurnal
                                                    </Link>
                                                </Button>
                                            </div>

                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                <p>
                                                    Biriktirilgan sana: {item.startDate}
                                                </p>
                                                {item.endDate && (
                                                    <p>
                                                        Tugash sanasi: {item.endDate}
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}
        </div>
    );
}
