import { useId, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, NotebookPen, Plus, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch, authorizedPost } from '@/lib/auth-session';
import { academicYearFor, academicYearOptions, addDays, formatDateLong, todayInTashkent } from '@/lib/date';
import { localizedName } from '@/lib/localized';
import { personFullName } from '@/lib/person';
import type { School } from '@/types/school';

import { shortTime } from '../lesson-schedules/schedule-utils';

interface SchoolClass {
    id: number;
    name: string;
    schoolId: number;
    academicYear: string;
}

interface PersonName {
    firstName: string;
    lastName: string;
    middleName: string | null;
}

interface LessonSchedule {
    id: number;
    lessonNumber: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    subject: { id: number; nameUz: string };
    teacher: PersonName;
}

type SessionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface LessonSession {
    id: number;
    lessonScheduleId: number;
    lessonNumber: number;
    lessonDate: string;
    startTime: string;
    endTime: string;
    topicTitle: string | null;
    homework: string | null;
    teacherNotes: string | null;
    status: SessionStatus;
    textbookTopicId: number | null;
    subject: { id: number; nameUz: string };
    teacher: PersonName;
}

interface AvailableTextbookTopic {
    id: number;
    title: string;
    chapterTitle: string | null;
    orderIndex: number;
    pageStart: number | null;
    pageEnd: number | null;
    textbook: { id: number; title: string; languageCode: string; gradeLevel: number };
}

const STATUSES: SessionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STATUS_TONE = { PLANNED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'danger' } as const;

/** JS `getUTCDay()`: 0 = yakshanba, 1 = dushanba … 6 = shanba — backend `dayOfWeek` bilan mos. */
function dayOfWeekOf(date: string): number {
    return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function SessionEditor({ session, onSaved }: { session: LessonSession; onSaved: () => void }) {
    const { t } = useTranslation();
    const id = useId();
    const topicsQuery = useApiQuery<AvailableTextbookTopic[]>(`/lesson-sessions/${session.id}/available-topics`);

    const [selectedTopicId, setSelectedTopicId] = useState(session.textbookTopicId == null ? '' : String(session.textbookTopicId));
    const [topicTitle, setTopicTitle] = useState(session.topicTitle ?? '');
    const [homework, setHomework] = useState(session.homework ?? '');
    const [teacherNotes, setTeacherNotes] = useState(session.teacherNotes ?? '');
    const [status, setStatus] = useState<SessionStatus>(session.status);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const availableTopics = topicsQuery.data ?? [];
    const selectedTopic = availableTopics.find((topic) => String(topic.id) === selectedTopicId);

    async function handleSave() {
        if (saving) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await authorizedPatch(`/lesson-sessions/${session.id}`, {
                textbookTopicId: selectedTopicId ? Number(selectedTopicId) : null,
                ...(selectedTopicId ? {} : { topicTitle: topicTitle.trim() || null }),
                homework: homework.trim() || null,
                teacherNotes: teacherNotes.trim() || null,
                status,
            });
            setSuccess(t('journal.saved'));
            onSaved();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('journal.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    const pages =
        selectedTopic?.pageStart == null
            ? '—'
            : selectedTopic.pageEnd != null && selectedTopic.pageEnd !== selectedTopic.pageStart
                ? `${selectedTopic.pageStart}–${selectedTopic.pageEnd}`
                : String(selectedTopic.pageStart);

    return (
        <Card className="min-w-0">
            <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">
                            {session.lessonNumber}
                        </span>
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold [overflow-wrap:anywhere]">{localizedName(session.subject)}</CardTitle>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {personFullName(session.teacher)} · <span className="tabular-nums">{shortTime(session.startTime)}–{shortTime(session.endTime)}</span>
                            </p>
                        </div>
                    </div>
                    <StatusBadge tone={STATUS_TONE[session.status]}>{t(`journal.status.${session.status}`)}</StatusBadge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <Field
                    htmlFor={`${id}-textbook-topic`}
                    label={t('journal.textbookTopic')}
                    error={topicsQuery.error || undefined}
                    hint={!topicsQuery.loading && !topicsQuery.error && availableTopics.length === 0 ? t('journal.noTopics') : undefined}
                >
                    <SelectField
                        id={`${id}-textbook-topic`}
                        value={selectedTopicId}
                        onValueChange={(value) => {
                            setSelectedTopicId(value);
                            const topic = availableTopics.find((item) => String(item.id) === value);
                            if (topic) setTopicTitle(topic.title);
                        }}
                        emptyOption={t('journal.manualTopic')}
                        searchable
                        disabled={saving || topicsQuery.loading || Boolean(topicsQuery.error)}
                        options={availableTopics.map((topic) => ({
                            value: String(topic.id),
                            label: `${topic.orderIndex}. ${topic.title}`,
                            keywords: [topic.title, topic.chapterTitle, topic.textbook.title].filter(Boolean).join(' '),
                        }))}
                    />
                </Field>

                {selectedTopic ? (
                    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
                        <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                            <p className="font-medium [overflow-wrap:anywhere]">{selectedTopic.textbook.title}</p>
                            {selectedTopic.chapterTitle && (
                                <p className="text-muted-foreground">{t('journal.chapter', { title: selectedTopic.chapterTitle })}</p>
                            )}
                            <p className="text-muted-foreground tabular-nums">{t('textbooks.topics.pagesValue', { pages })}</p>
                        </div>
                    </div>
                ) : (
                    <Field htmlFor={`${id}-topic`} label={t('journal.topic')}>
                        <Input
                            id={`${id}-topic`}
                            value={topicTitle}
                            onChange={(event) => setTopicTitle(event.target.value)}
                            maxLength={255}
                            placeholder={t('journal.topicPlaceholder')}
                            disabled={saving}
                        />
                    </Field>
                )}

                <Field htmlFor={`${id}-homework`} label={t('journal.homework')}>
                    <Textarea
                        id={`${id}-homework`}
                        value={homework}
                        onChange={(event) => setHomework(event.target.value)}
                        maxLength={10000}
                        placeholder={t('journal.homeworkPlaceholder')}
                        disabled={saving}
                    />
                </Field>

                <Field htmlFor={`${id}-notes`} label={t('journal.notes')}>
                    <Textarea
                        id={`${id}-notes`}
                        value={teacherNotes}
                        onChange={(event) => setTeacherNotes(event.target.value)}
                        maxLength={10000}
                        disabled={saving}
                    />
                </Field>

                <Field htmlFor={`${id}-status`} label={t('journal.statusLabel')}>
                    <SelectField
                        id={`${id}-status`}
                        value={status}
                        onValueChange={(value) => setStatus(value as SessionStatus)}
                        options={STATUSES.map((value) => ({ value, label: t(`journal.status.${value}`) }))}
                        disabled={saving}
                    />
                </Field>

                {error && <ErrorState message={error} />}
                {success && <SuccessNotice>{success}</SuccessNotice>}

                <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? t('common.saving') : t('common.save')}
                </Button>
            </CardContent>
        </Card>
    );
}

function JournalForClass({ schoolId, academicYear, classId, date }: { schoolId: number; academicYear: string; classId: number; date: string }) {
    const { t } = useTranslation();
    const [creatingId, setCreatingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const sessionsQuery = useApiQuery<LessonSession[]>(
        `/lesson-sessions?${new URLSearchParams({ schoolId: String(schoolId), classId: String(classId), date })}`,
    );
    // `date` bilan so‘ralganda haftalik jadvalning aynan shu sanada amal qilgan versiyasi qaytadi.
    const schedulesQuery = useApiQuery<LessonSchedule[]>(
        `/lesson-schedules?${new URLSearchParams({ schoolId: String(schoolId), classId: String(classId), academicYear, date })}`,
    );

    const sessions = [...(sessionsQuery.data ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
    const selectedDay = dayOfWeekOf(date);
    const schedules = (schedulesQuery.data ?? []).filter((lesson) => lesson.dayOfWeek === selectedDay);
    const existing = new Set(sessions.map((session) => session.lessonScheduleId));
    const missing = schedules.filter((schedule) => !existing.has(schedule.id)).sort((a, b) => a.lessonNumber - b.lessonNumber);

    async function createSession(lessonScheduleId: number) {
        if (creatingId !== null) return;
        setCreatingId(lessonScheduleId);
        setError('');
        setSuccess('');
        try {
            await authorizedPost('/lesson-sessions', { lessonScheduleId, lessonDate: date });
            setSuccess(t('journal.sessionCreated'));
            sessionsQuery.retry();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('journal.errors.createFailed'));
        } finally {
            setCreatingId(null);
        }
    }

    const loading = sessionsQuery.loading || schedulesQuery.loading;
    const loadError = sessionsQuery.error || schedulesQuery.error;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-heading text-lg font-bold">{formatDateLong(date)}</h2>
                    <p className="text-sm text-muted-foreground">{t('journal.entries', { count: sessions.length })}</p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        sessionsQuery.retry();
                        schedulesQuery.retry();
                    }}
                >
                    <RotateCw aria-hidden="true" />
                    {t('common.refresh')}
                </Button>
            </div>

            {loading ? (
                <LoadingState rows={4} />
            ) : loadError ? (
                <ErrorState
                    message={loadError}
                    onRetry={() => {
                        sessionsQuery.retry();
                        schedulesQuery.retry();
                    }}
                />
            ) : (
                <>
                    {missing.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold">{t('journal.missingTitle')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2.5">
                                {missing.map((schedule) => (
                                    <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                                        <div className="min-w-0">
                                            <p className="font-medium [overflow-wrap:anywhere]">
                                                {t('schedule.lessonLabel', { n: schedule.lessonNumber, subject: localizedName(schedule.subject) })}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {personFullName(schedule.teacher)} · <span className="tabular-nums">{shortTime(schedule.startTime)}–{shortTime(schedule.endTime)}</span>
                                            </p>
                                        </div>
                                        <Button type="button" size="sm" disabled={creatingId !== null} onClick={() => void createSession(schedule.id)}>
                                            <Plus aria-hidden="true" />
                                            {creatingId === schedule.id ? t('common.creating') : t('journal.addToJournal')}
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {error && <ErrorState message={error} />}
                    {success && <SuccessNotice>{success}</SuccessNotice>}

                    {sessions.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2 min-[1800px]:grid-cols-3">
                            {sessions.map((session) => (
                                <SessionEditor key={session.id} session={session} onSaved={sessionsQuery.retry} />
                            ))}
                        </div>
                    ) : (
                        missing.length === 0 && <EmptyState icon={NotebookPen} title={t('journal.emptyTitle')} description={t('journal.empty')} />
                    )}
                </>
            )}
        </div>
    );
}

function ClassPicker({
    schoolId,
    academicYear,
    value,
    onChange,
}: {
    schoolId: string;
    academicYear: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const query = useApiQuery<SchoolClass[]>(`/classes?schoolId=${schoolId}&academicYear=${academicYear}`);

    return (
        <Field htmlFor={`${id}-class`} label={t('common.class')} error={query.error || undefined}>
            <SelectField
                id={`${id}-class`}
                value={value}
                onValueChange={onChange}
                placeholder={query.loading ? t('common.loading') : t('members.chooseClass')}
                disabled={query.loading || Boolean(query.error)}
                options={(query.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
            />
        </Field>
    );
}

export function JournalPage() {
    const { t } = useTranslation();
    const id = useId();
    const schoolsQuery = useApiQuery<School[]>('/schools');
    const today = todayInTashkent();

    const [pickedSchoolId, setSchoolId] = useState('');
    const [academicYear, setAcademicYear] = useState(() => academicYearFor(today));
    const [classId, setClassId] = useState('');
    const schools = schoolsQuery.data ?? [];
    // Bitta maktab bo‘lsa (masalan, maktab administratori), u avtomatik tanlanadi.
    const schoolId = pickedSchoolId || (schools.length === 1 ? String(schools[0].id) : '');
    const [date, setDate] = useState(today);

    const yearStart = Number(academicYear.slice(0, 4));
    const yearMin = `${yearStart}-09-01`;
    const yearMax = `${yearStart + 1}-08-31`;
    const dateValid = Boolean(date) && date >= yearMin && date <= yearMax;

    function shiftDate(days: number) {
        const next = addDays(date, days);
        if (next >= yearMin && next <= yearMax) setDate(next);
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('journal.title')} description={t('journal.subtitle')} />

            <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                <Field htmlFor={`${id}-school`} label={t('common.school')} error={schoolsQuery.error || undefined}>
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={(value) => {
                            setSchoolId(value);
                            setClassId('');
                        }}
                        options={schools.map((school) => ({ value: String(school.id), label: `${school.name} — ${school.district.name}` }))}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        disabled={schoolsQuery.loading || Boolean(schoolsQuery.error)}
                    />
                </Field>

                <Field htmlFor={`${id}-year`} label={t('members.academicYear')}>
                    <SelectField
                        id={`${id}-year`}
                        value={academicYear}
                        onValueChange={(value) => {
                            setAcademicYear(value);
                            setClassId('');
                            const start = Number(value.slice(0, 4));
                            const min = `${start}-09-01`;
                            const max = `${start + 1}-08-31`;
                            setDate(today >= min && today <= max ? today : min);
                        }}
                        options={academicYearOptions(academicYear).map((year) => ({ value: year, label: year }))}
                    />
                </Field>

                {schoolId ? (
                    <ClassPicker key={`${schoolId}-${academicYear}`} schoolId={schoolId} academicYear={academicYear} value={classId} onChange={setClassId} />
                ) : (
                    <Field htmlFor={`${id}-class`} label={t('common.class')}>
                        <SelectField id={`${id}-class`} value="" onValueChange={() => undefined} disabled placeholder={t('filters.chooseSchoolFirst')} options={[]} />
                    </Field>
                )}

                <Field htmlFor={`${id}-date`} label={t('journal.lessonDate')} error={date && !dateValid ? t('journal.errors.dateOutOfYear') : undefined}>
                    <div className="flex gap-1.5">
                        <Button type="button" variant="outline" size="icon" className="h-11 shrink-0 bg-card" aria-label={t('attendance.prevDay')} onClick={() => shiftDate(-1)}>
                            <ChevronLeft aria-hidden="true" />
                        </Button>
                        <Input id={`${id}-date`} type="date" min={yearMin} max={yearMax} value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0" />
                        <Button type="button" variant="outline" size="icon" className="h-11 shrink-0 bg-card" aria-label={t('attendance.nextDay')} onClick={() => shiftDate(1)}>
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </Field>
            </div>

            {schoolId && classId && dateValid ? (
                <JournalForClass
                    key={`${schoolId}-${classId}-${academicYear}-${date}`}
                    schoolId={Number(schoolId)}
                    classId={Number(classId)}
                    academicYear={academicYear}
                    date={date}
                />
            ) : (
                <EmptyState icon={NotebookPen} title={t('journal.chooseTitle')} description={t('journal.choose')} />
            )}
        </div>
    );
}
