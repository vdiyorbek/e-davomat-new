import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ChevronRight, FilePlus2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { School } from '@/types/school';
import type { SchoolMembership, SchoolMembershipsPage } from '@/types/school-membership';

import { AttendanceExcuseForm } from './AttendanceExcuseForm';
import type { ExcuseStudentSelection } from './AttendanceExcuseForm';

interface Props {
    onSaved: () => void;
}

function StudentSearchResults({
    schoolId,
    query,
    onSelect,
}: {
    schoolId: number;
    query: string;
    onSelect: (membership: SchoolMembership) => void;
}) {
    const { t } = useTranslation();
    const params = new URLSearchParams({ schoolId: String(schoolId), type: 'STUDENT', q: query, page: '1', limit: '50' });
    const { data, loading, error, retry } = useApiQuery<SchoolMembershipsPage>(`/school-memberships?${params.toString()}`);

    // O‘quvchi sinf almashtirgan bo‘lishi mumkin — ro‘yxatda takrorlamaymiz.
    const unique = new Map<number, SchoolMembership>();
    for (const membership of data?.data ?? []) {
        if (membership.person && !unique.has(membership.person.id)) unique.set(membership.person.id, membership);
    }

    if (loading) {
        return (
            <div role="status" className="space-y-2">
                <span className="sr-only">{t('excuses.create.searching')}</span>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
            </div>
        );
    }
    if (error) return <ErrorState message={error} onRetry={retry} />;
    if (unique.size === 0) return <p className="text-sm text-muted-foreground">{t('excuses.create.noStudents')}</p>;

    return (
        <div className="space-y-2">
            <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border p-1.5">
                {[...unique.values()].map((membership) => {
                    const person = membership.person!;
                    return (
                        <li key={person.id}>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onSelect(membership)}
                                className="h-auto w-full justify-between gap-3 rounded-lg px-3 py-2.5 text-left whitespace-normal"
                            >
                                <span className="min-w-0">
                                    <span className="block font-semibold">{personFullName(person)}</span>
                                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground tabular-nums">
                                        {t('common.pnfl')}: {person.pnfl}
                                        {membership.schoolClass ? ` · ${membership.schoolClass.name}` : ''}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                                    {t('excuses.create.select')}
                                    <ChevronRight aria-hidden="true" className="size-4" />
                                </span>
                            </Button>
                        </li>
                    );
                })}
            </ul>
            {data && data.total > 50 && <p className="text-xs text-muted-foreground">{t('excuses.create.first50')}</p>}
        </div>
    );
}

export function CreateAttendanceExcuseDialog({ onSaved }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();

    const [open, setOpen] = useState(false);
    const [chosenSchoolId, setChosenSchoolId] = useState('');
    const [searchText, setSearchText] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [searchError, setSearchError] = useState('');
    const [student, setStudent] = useState<ExcuseStudentSelection | null>(null);

    const { data: schools, loading: schoolsLoading, error: schoolsError } = useApiQuery<School[]>('/schools');

    const profile = session?.profile;
    const schoolId = profile?.role === 'SCHOOL_ADMIN' ? String(profile.schoolId ?? '') : chosenSchoolId;
    const selectedSchool = (schools ?? []).find((school) => String(school.id) === schoolId);

    function resetSelection() {
        setStudent(null);
        setSearchText('');
        setAppliedSearch('');
        setSearchError('');
    }

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = searchText.trim().replace(/\s+/g, ' ');
        if (value.length < 2) {
            setSearchError(t('excuses.create.minChars'));
            setAppliedSearch('');
            return;
        }
        setSearchError('');
        setStudent(null);
        setAppliedSearch(value);
    }

    function handleSelect(membership: SchoolMembership) {
        if (!membership.person || !selectedSchool) return;
        setStudent({
            personId: membership.person.id,
            schoolId: selectedSchool.id,
            name: personFullName(membership.person),
            schoolName: selectedSchool.name,
            className: membership.schoolClass?.name ?? null,
            defaultDate: todayInTashkent(),
        });
    }

    function closeDialog() {
        setOpen(false);
        resetSelection();
    }

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
            <DialogTrigger asChild>
                <Button type="button">
                    <FilePlus2 aria-hidden="true" />
                    {t('excuses.create.button')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('excuses.create.title')}</DialogTitle>
                    <DialogDescription>{t('excuses.create.description')}</DialogDescription>
                </DialogHeader>

                {student ? (
                    <div className="space-y-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => setStudent(null)}>
                            <ArrowLeft aria-hidden="true" />
                            {t('excuses.create.another')}
                        </Button>
                        <AttendanceExcuseForm
                            selection={student}
                            onSaved={() => {
                                closeDialog();
                                onSaved();
                            }}
                            onCancel={closeDialog}
                        />
                    </div>
                ) : (
                    <div className="space-y-5">
                        <Field htmlFor={`${id}-school`} label={t('common.school')} required error={schoolsError || undefined}>
                            <SelectField
                                id={`${id}-school`}
                                value={schoolId}
                                disabled={schoolsLoading || profile?.role === 'SCHOOL_ADMIN'}
                                placeholder={schoolsLoading ? t('common.loading') : t('members.chooseSchool')}
                                searchable
                                onValueChange={(value) => {
                                    setChosenSchoolId(value);
                                    resetSelection();
                                }}
                                options={(schools ?? []).map((school) => ({
                                    value: String(school.id),
                                    label: `${school.district.name} / ${school.name}`,
                                }))}
                            />
                        </Field>

                        {selectedSchool && (
                            <form onSubmit={handleSearch}>
                                <Field htmlFor={`${id}-search`} label={t('excuses.create.searchLabel')} error={searchError || undefined}>
                                    <div className="flex gap-2">
                                        <Input
                                            id={`${id}-search`}
                                            type="search"
                                            value={searchText}
                                            maxLength={100}
                                            placeholder={t('excuses.create.searchPlaceholder')}
                                            onChange={(event) => {
                                                setSearchText(event.target.value);
                                                setAppliedSearch('');
                                                setSearchError('');
                                            }}
                                        />
                                        <Button type="submit" variant="secondary" className="h-11 shrink-0">
                                            <Search aria-hidden="true" />
                                            <span className="max-sm:sr-only">{t('common.search')}</span>
                                        </Button>
                                    </div>
                                </Field>
                            </form>
                        )}

                        {selectedSchool && appliedSearch && (
                            <StudentSearchResults
                                key={`${schoolId}|${appliedSearch}`}
                                schoolId={selectedSchool.id}
                                query={appliedSearch}
                                onSelect={handleSelect}
                            />
                        )}

                        <p className="text-xs leading-5 text-muted-foreground">{t('excuses.create.note')}</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
