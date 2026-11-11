
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, BookOpen, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { localizedName } from '@/lib/localized';
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

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export function TeacherJournalPage() {
    const { t } = useTranslation();
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
                    : t('teacher.journal.createFailed'),
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
                eyebrow={t('teacher.eyebrow')}
                title={t('teacher.journal.title')}
                description={t('teacher.journal.description')}
                actions={
                    <Button asChild variant="outline">
                        <Link to="/teacher/dashboard">
                            <ArrowLeft aria-hidden="true" />
                            {t('teacher.journal.back')}
                        </Link>
                    </Button>
                }
            />

            {!validAssignmentId && (
                <ErrorState message={t('teacher.journal.invalidId')} />
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
                                    {t('teacher.journal.date')}
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
                                {t('common.refresh')}
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
                                            {t('teacher.dashboard.className', { name: data.assignment.class.name })}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {localizedName(data.assignment.subject)}
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
                                        title={t('teacher.journal.emptyTitle')}
                                        description={t('teacher.journal.empty')}
                                    />
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {data.sessions.map((session) => (
                                            <Card key={session.id}>
                                                <CardHeader>
                                                    <CardTitle className="text-base">
                                                        {t('teacher.journal.lesson', { n: session.lessonNumber })}
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
                                                            {t('teacher.journal.status')}:
                                                        </span>{' '}
                                                        {STATUSES.includes(session.status)
                                                            ? t(`teacher.session.statuses.${session.status}`)
                                                            : session.status}
                                                    </p>

                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {t('teacher.journal.topic')}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {session.topicTitle ??
                                                                t('teacher.journal.noTopic')}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {t('teacher.journal.homework')}
                                                        </p>
                                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                                            {session.homework ??
                                                                t('teacher.journal.noHomework')}
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
                                                        {t('teacher.journal.lesson', { n: schedule.lessonNumber })}
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
                                                            ? t('teacher.journal.creating')
                                                            : t('teacher.journal.create')}
                                                    </Button>
                                                    <p className="text-sm text-muted-foreground">
                                                        {schedule.startTime.slice(0, 5)}
                                                        {' – '}
                                                        {schedule.endTime.slice(0, 5)}
                                                    </p>
                                                    <p className="text-sm">
                                                        {t('teacher.journal.notCreated')}
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
