import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AttendanceExcuseForm } from '@/components/attendance/AttendanceExcuseForm';
import type { ExcuseStudentSelection } from '@/components/attendance/AttendanceExcuseForm';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { AbsenteesTab } from '@/components/homeroom/AbsenteesTab';
import { ExcusesTab } from '@/components/homeroom/ExcusesTab';
import { TodayTab } from '@/components/homeroom/TodayTab';
import { WeekTab } from '@/components/homeroom/WeekTab';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { HomeroomClass, HomeroomWeek } from '@/types/homeroom';

const TABS = ['today', 'week', 'absentees', 'excuses'] as const;
type Tab = (typeof TABS)[number];

/** Yangi ariza: o‘quvchini tanlash va formani to‘ldirish. */
function SubmitExcuseDialog({
    cls,
    personId,
    open,
    onClose,
    onSaved,
}: {
    cls: HomeroomClass;
    personId: number | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const today = todayInTashkent();
    const students = useApiQuery<HomeroomWeek>(open ? `/homeroom/classes/${cls.id}/week?from=${today}&to=${today}` : `/homeroom/classes/${cls.id}/week?from=${today}&to=${today}`);
    const [chosen, setChosen] = useState('');
    const selectedId = personId !== null ? String(personId) : chosen;
    const person = (students.data?.students ?? []).find((s) => String(s.personId) === selectedId);

    const selection: ExcuseStudentSelection | null = person
        ? {
              personId: person.personId,
              schoolId: cls.schoolId,
              name: personFullName(person),
              schoolName: cls.schoolName,
              className: cls.name,
              defaultDate: today,
          }
        : null;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('homeroom.excuses.new')}</DialogTitle>
                    <DialogDescription>{t('homeroom.excuses.flow')}</DialogDescription>
                </DialogHeader>
                {personId === null && (
                    <Field htmlFor="homeroom-excuse-student" label={t('excuses.student')} required>
                        <SelectField
                            id="homeroom-excuse-student"
                            value={chosen}
                            onValueChange={setChosen}
                            searchable
                            disabled={students.loading}
                            placeholder={t('homeroom.excuses.chooseStudent')}
                            options={(students.data?.students ?? []).map((s) => ({ value: String(s.personId), label: personFullName(s) }))}
                        />
                    </Field>
                )}
                {selection && (
                    <AttendanceExcuseForm
                        key={selection.personId}
                        selection={selection}
                        submitPath={`/homeroom/classes/${cls.id}/excuses`}
                        onSaved={() => {
                            onSaved();
                            onClose();
                        }}
                        onCancel={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Sinf rahbari kabineti: o‘z sinfi davomati, kelmaganlar va arizalar. */
export function HomeroomPage() {
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const { data, loading, error, retry } = useApiQuery<HomeroomClass[]>('/homeroom/classes');
    const [dialog, setDialog] = useState<{ personId: number | null } | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const tabParam = params.get('tab');
    const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'today';
    const classes = data ?? [];
    const cls = classes.find((item) => String(item.id) === params.get('class')) ?? classes[0];

    function update(changes: Record<string, string>) {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
        }
        setParams(next);
    }

    return (
        <div className="space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('homeroom.title')} description={t('homeroom.description')} />

            {loading ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={error} onRetry={retry} />
            ) : !cls ? (
                <EmptyState icon={ClipboardCheck} title={t('homeroom.noClassTitle')} description={t('homeroom.noClass')} />
            ) : (
                <>
                    <div className="flex flex-wrap items-end gap-4">
                        {classes.length > 1 ? (
                            <div className="w-64">
                                <Field htmlFor="homeroom-class" label={t('common.class')}>
                                    <SelectField
                                        id="homeroom-class"
                                        value={String(cls.id)}
                                        onValueChange={(value) => update({ class: value })}
                                        options={classes.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.schoolName}` }))}
                                    />
                                </Field>
                            </div>
                        ) : null}
                        <div className="rounded-xl border bg-card px-4 py-2">
                            <p className="font-heading text-lg font-bold">{cls.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {cls.schoolName} · {t('classes.studentsCount', { count: cls.students })}
                            </p>
                        </div>
                    </div>

                    <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'today' ? '' : value })}>
                        <TabsList className="h-auto w-full flex-wrap sm:w-fit">
                            {TABS.map((item) => (
                                <TabsTrigger key={item} value={item} className="px-4">
                                    {t(`homeroom.tabs.${item}`)}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    {tab === 'today' && <TodayTab key={cls.id} classId={cls.id} />}
                    {tab === 'week' && <WeekTab key={cls.id} classId={cls.id} />}
                    {tab === 'absentees' && <AbsenteesTab key={cls.id} classId={cls.id} onExcuse={(personId) => setDialog({ personId })} />}
                    {tab === 'excuses' && <ExcusesTab key={cls.id} classId={cls.id} reloadKey={reloadKey} onNew={() => setDialog({ personId: null })} />}

                    {dialog && (
                        <SubmitExcuseDialog
                            cls={cls}
                            personId={dialog.personId}
                            open
                            onClose={() => setDialog(null)}
                            onSaved={() => {
                                setReloadKey((value) => value + 1);
                                update({ tab: 'excuses' });
                            }}
                        />
                    )}
                </>
            )}
        </div>
    );
}
