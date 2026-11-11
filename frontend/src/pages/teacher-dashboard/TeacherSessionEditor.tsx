
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import {
    ErrorState,
    SuccessNotice,
} from '@/components/common/states';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch } from '@/lib/auth-session';

type SessionStatus =
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED';

export interface EditableTeacherSession {
    id: number;
    textbookTopicId: number | null;
    topicTitle: string | null;
    homework: string | null;
    teacherNotes: string | null;
    status: SessionStatus;
}

interface Topic {
    id: number;
    title: string;
    orderIndex: number;
    textbook: {
        id: number;
        title: string;
    };
}

const EDITABLE_STATUSES: SessionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];

export function TeacherSessionEditor({
    assignmentId,
    session,
    onSaved,
}: {
    assignmentId: number;
    session: EditableTeacherSession;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const [topicId, setTopicId] = useState(
        session.textbookTopicId === null
            ? ''
            : String(session.textbookTopicId),
    );

    const [title, setTitle] = useState(
        session.topicTitle ?? '',
    );
    const [homework, setHomework] = useState(
        session.homework ?? '',
    );
    const [teacherNotes, setTeacherNotes] = useState(
        session.teacherNotes ?? '',
    );
    const [status, setStatus] = useState<SessionStatus>(
        session.status,
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const topicsQuery = useApiQuery<Topic[]>(
        `/teacher/me/journal/${assignmentId}/sessions/${session.id}/topics`,
    );

    const topics = topicsQuery.data ?? [];

    async function save() {
        if (saving) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await authorizedPatch(
                `/teacher/me/journal/${assignmentId}/sessions/${session.id}`,
                {
                    textbookTopicId: topicId
                        ? Number(topicId)
                        : null,
                    ...(topicId
                        ? {}
                        : { topicTitle: title.trim() || null }),
                    homework: homework.trim() || null,
                    teacherNotes: teacherNotes.trim() || null,
                    status,
                },
            );

            setSuccess(t('teacher.session.saved'));
            onSaved();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : t('teacher.session.saveFailed'),
            );
        } finally {
            setSaving(false);
        }
    }

    const disabled =
        saving || session.status === 'CANCELLED';

    return (
        <div className="space-y-4 border-t pt-4">
            <Field
                htmlFor={`topic-${session.id}`}
                label={t('teacher.session.textbookTopic')}
            >
                <SelectField
                    id={`topic-${session.id}`}
                    value={topicId}
                    onValueChange={(value) => {
                        setTopicId(value);

                        const topic = topics.find(
                            (item) => String(item.id) === value,
                        );

                        if (topic) setTitle(topic.title);
                    }}
                    emptyOption={t('teacher.session.manual')}
                    searchable
                    placeholder={t('teacher.session.chooseTopic')}
                    disabled={
                        disabled ||
                        topicsQuery.loading ||
                        Boolean(topicsQuery.error)
                    }
                    options={topics.map((topic) => ({
                        value: String(topic.id),
                        label: `${topic.orderIndex}. ${topic.title}`,
                        keywords: topic.textbook.title,
                    }))}
                />
            </Field>

            {topicsQuery.error && (
                <ErrorState
                    message={topicsQuery.error}
                    onRetry={topicsQuery.retry}
                />
            )}

            {!topicId && (
                <Field
                    htmlFor={`title-${session.id}`}
                    label={t('teacher.session.manualTopic')}
                >
                    <Input
                        id={`title-${session.id}`}
                        value={title}
                        onChange={(event) =>
                            setTitle(event.target.value)
                        }
                        maxLength={255}
                        disabled={disabled}
                    />
                </Field>
            )}

            <Field
                htmlFor={`homework-${session.id}`}
                label={t('teacher.session.homework')}
            >
                <Textarea
                    id={`homework-${session.id}`}
                    value={homework}
                    onChange={(event) =>
                        setHomework(event.target.value)
                    }
                    maxLength={10000}
                    disabled={disabled}
                />
            </Field>

            <Field
                htmlFor={`notes-${session.id}`}
                label={t('teacher.session.notes')}
            >
                <Textarea
                    id={`notes-${session.id}`}
                    value={teacherNotes}
                    onChange={(event) =>
                        setTeacherNotes(event.target.value)
                    }
                    maxLength={10000}
                    disabled={disabled}
                />
            </Field>

            <Field
                htmlFor={`status-${session.id}`}
                label={t('teacher.session.status')}
            >
                <SelectField
                    id={`status-${session.id}`}
                    value={status}
                    onValueChange={(value) =>
                        setStatus(value as SessionStatus)
                    }
                    disabled={disabled}
                    options={EDITABLE_STATUSES.map((value) => ({
                        value,
                        label: t(`teacher.session.statuses.${value}`),
                    }))}
                />
            </Field>

            {error && <ErrorState message={error} />}

            {success && (
                <SuccessNotice>{success}</SuccessNotice>
            )}

            <Button
                type="button"
                onClick={() => void save()}
                disabled={disabled}
                className="w-full"
            >
                {saving ? t('common.saving') : t('teacher.session.save')}
            </Button>
        </div>
    );
}
