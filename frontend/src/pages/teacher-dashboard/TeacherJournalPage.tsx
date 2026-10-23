
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, BookOpen, RotateCw } from 'lucide-react';

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
import { todayInTashkent } from '@/lib/date';
import { authorizedPost } from '@/lib/auth-session';
import {
    TeacherSessionEditor,
} from './TeacherSessionEditor';

interface TeacherJournalResponse {
    assignment: {
        id: number;
        class: {
            id: number;
            name: string;
            academicYear: string;
        };
        subject: {
            id: number;
            nameUz: string;
        };
    };
    date: string;
    schedules: {
        id: number;
        lessonNumber: number;
        startTime: string;
        endTime: string;
    }[];
    sessions: {
        id: number;
        lessonScheduleId: number;
        lessonNumber: number;
        startTime: string;
        endTime: string;
        topicTitle: string | null;
        homework: string | null;
        textbookTopicId: number | null;
        teacherNotes: string | null;
        status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    }[];
}

const STATUS_LABELS: Record<string, string> = {
    PLANNED: 'Rejalashtirilgan',
    IN_PROGRESS: 'O‘tilmoqda',
    COMPLETED: 'O‘tilgan',
    CANCELLED: 'Bekor qilingan',
};

export function TeacherJournalPage() {
    const { assignmentId } = useParams();
    const [date, setDate] = useState(todayInTashkent);

    const validAssignmentId =
        assignmentId != null &&
        /^[1-9]\d*$/.test(assignmentId);

    const journalQuery = useApiQuery<TeacherJournalResponse>(
        `/teacher/me/journal/${validAssignmentId ? assignmentId : '0'
        }?date=${date}`,
    );


    const [creatingId, setCreatingId] =
        useState<number | null>(null);

    const [createError, setCreateError] = useState('');

    async function createSession(scheduleId: number) {
        if (!validAssignmentId || creatingId !== null) {
            return;
        }

        setCreatingId(scheduleId);
        setCreateError('');

        try {
            await authorizedPost(
                `/teacher/me/journal/${assignmentId}/sessions`,
                {
                    lessonScheduleId: scheduleId,
                    lessonDate: date,
                },
            );

            journalQuery.retry();
        } catch (caught: unknown) {
            setCreateError(
                caught instanceof Error
                    ? caught.message
                    : 'Jurnal sessiyasini yaratib bo‘lmadi',
            );
        } finally {
            setCreatingId(null);
        }
    }


    const data = journalQuery.data;

    const existingScheduleIds = new Set(
        data?.sessions.map(
            (session) => session.lessonScheduleId,
        ) ?? [],
    );

    const schedulesWithoutSession =
        data?.schedules.filter(
            (schedule) => !existingScheduleIds.has(schedule.id),
        ) ?? [];

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="O‘qituvchi kabineti"
                title="Mening elektron jurnalim"
                description="O‘zingizga biriktirilgan fan va sinf darslari"
                actions={
                    <Button asChild variant="outline">
                        <Link to="/teacher/dashboard">
                            <ArrowLeft aria-hidden="true" />
                            Kabinetga qaytish
                        </Link>
                    </Button>
                }
            />

            {!validAssignmentId && (
                <ErrorState message="Biriktirma ID noto‘g‘ri." />
            )}

            {validAssignmentId && (
                <>
                    <Card>
                        <CardContent className="flex flex-wrap items-end gap-4">
                            <div className="space-y-2">
                                <label
                                    htmlFor="teacher-journal-date"
                                    className="text-sm font-medium"
                                >
                                    Dars sanasi
                                </label>
                                <Input
                                    id="teacher-journal-date"
                                    type="date"
                                    value={date}
                                    onChange={(event) =>
                                        setDate(event.target.value)
                                    }
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={journalQuery.loading}
                                onClick={journalQuery.retry}
                            >
                                <RotateCw aria-hidden="true" />
                                Yangilash
                            </Button>
                        </CardContent>
                    </Card>

                    {journalQuery.loading && (
                        <LoadingState rows={4} />
                    )}

                    {journalQuery.error && (
                        <ErrorState
                            message={journalQuery.error}
                            onRetry={journalQuery.retry}
                        />
                    )}

                    {!journalQuery.loading &&
                        !journalQuery.error &&
                        data && (
                            <>
                                <Card>
                                    <CardContent className="space-y-1">
                                        <p className="text-xl font-semibold">
                                            {data.assignment.class.name} sinf
                                        </p>
                                        <p className="text-muted-foreground">
                                            {data.assignment.subject.nameUz}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {data.assignment.class.academicYear}
                                        </p>
                                    </CardContent>
                                </Card>

                                {data.sessions.length === 0 &&
                                    schedulesWithoutSession.length === 0 ? (
                                    <EmptyState
                                        icon={BookOpen}
                                        title="Ushbu sanada dars topilmadi"
                                        description="Boshqa sanani tanlab ko‘ring."
                                    />
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {data.sessions.map((session) => (
                                            <Card key={session.id}>
                                                <CardHeader>
                                                    <CardTitle className="text-base">
                                                        {session.lessonNumber}-dars
                                                    </CardTitle>
                                                    <p className="text-sm text-muted-foreground">
                                                        {session.startTime.slice(0, 5)}
                                                        {' – '}
                                                        {session.endTime.slice(0, 5)}
                                                    </p>
                                                </CardHeader>

                                                <CardContent className="space-y-3">
                                                    <p className="text-sm">
                                                        <span className="font-medium">
                                                            Holati:
                                                        </span>{' '}
                                                        {STATUS_LABELS[session.status] ??
                                                            session.status}
                                                    </p>

                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            Dars mavzusi
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {session.topicTitle ??
                                                                'Mavzu kiritilmagan'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            Uy vazifasi
                                                        </p>
                                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                                            {session.homework ??
                                                                'Uy vazifasi kiritilmagan'}
                                                        </p>
                                                    </div>
                                                    <TeacherSessionEditor
                                                        key={session.id}
                                                        assignmentId={Number(assignmentId)}
                                                        session={session}
                                                        onSaved={journalQuery.retry}
                                                    />
                                                </CardContent>
                                            </Card>
                                        ))}

                                        {schedulesWithoutSession.map((schedule) => (
                                            <Card key={schedule.id}>
                                                <CardHeader>
                                                    <CardTitle className="text-base">
                                                        {schedule.lessonNumber}-dars
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    {createError && (
                                                        <ErrorState message={createError} />
                                                    )}
                                                    <Button
                                                        type="button"
                                                        disabled={creatingId !== null}
                                                        onClick={() => void createSession(schedule.id)}
                                                    >
                                                        {creatingId === schedule.id
                                                            ? 'Yaratilmoqda...'
                                                            : 'Jurnalga qo‘shish'}
                                                    </Button>
                                                    <p className="text-sm text-muted-foreground">
                                                        {schedule.startTime.slice(0, 5)}
                                                        {' – '}
                                                        {schedule.endTime.slice(0, 5)}
                                                    </p>
                                                    <p className="text-sm">
                                                        Jurnal yozuvi hali yaratilmagan.
                                                    </p>

                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                </>
            )}
        </div>
    );
}
