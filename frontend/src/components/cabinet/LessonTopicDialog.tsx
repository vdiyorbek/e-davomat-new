import { useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authorizedGet, authorizedPost } from '@/lib/auth-session';
import { formatDateLong } from '@/lib/date';
import { TeacherSessionEditor, type EditableTeacherSession } from '@/pages/teacher-dashboard/TeacherSessionEditor';
import type { TeacherCabinetLesson } from '@/types/cabinet';

interface JournalDay {
    sessions: (EditableTeacherSession & { lessonScheduleId: number })[];
}

/**
 * Dars vaqtida mavzuni tanlash: jurnal yozuvi bo‘lmasa yaratiladi,
 * keyin darslikdagi mavzu, uy vazifasi va holat kiritiladi.
 */
export function LessonTopicDialog({
    lesson,
    open,
    onOpenChange,
    onChanged,
}: {
    lesson: TeacherCabinetLesson;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: () => void;
}) {
    const { t } = useTranslation();
    const [session, setSession] = useState<EditableTeacherSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError('');
            try {
                const day = await authorizedGet<JournalDay>(
                    `/teacher/me/journal/${lesson.assignmentId}?date=${lesson.date}`,
                    controller.signal,
                );
                setSession(day.sessions.find((item) => item.lessonScheduleId === lesson.lessonScheduleId) ?? null);
            } catch (err: unknown) {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : t('common.loadFailed'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, [open, lesson.assignmentId, lesson.date, lesson.lessonScheduleId, attempt, t]);

    async function createSession() {
        if (creating) return;
        setCreating(true);
        setError('');
        try {
            await authorizedPost(`/teacher/me/journal/${lesson.assignmentId}/sessions`, {
                lessonScheduleId: lesson.lessonScheduleId,
                lessonDate: lesson.date,
            });
            onChanged();
            setAttempt((value) => value + 1);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('teacher.journal.createFailed'));
        } finally {
            setCreating(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {lesson.class.name} · {lesson.subject.nameUz}
                    </DialogTitle>
                    <DialogDescription>
                        {formatDateLong(lesson.date)} · {t('teacher.journal.lesson', { n: lesson.lessonNumber })} · {lesson.startTime}–
                        {lesson.endTime}
                    </DialogDescription>
                </DialogHeader>

                {loading && <LoadingState rows={3} />}
                {error && <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />}

                {!loading && !error && !session && (
                    <div className="space-y-3 text-center">
                        <p className="text-sm text-muted-foreground">{t('cabinet.lesson.noSession')}</p>
                        <Button type="button" onClick={() => void createSession()} disabled={creating}>
                            <BookOpenCheck aria-hidden="true" />
                            {creating ? t('teacher.journal.creating') : t('cabinet.lesson.start')}
                        </Button>
                    </div>
                )}

                {!loading && session && (
                    <TeacherSessionEditor
                        key={session.id}
                        assignmentId={lesson.assignmentId}
                        session={session}
                        onSaved={onChanged}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
