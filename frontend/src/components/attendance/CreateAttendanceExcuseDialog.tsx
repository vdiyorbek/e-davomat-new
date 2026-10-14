
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog } from 'radix-ui';
import { FilePlus2, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';

import {
    AttendanceExcuseForm,
    type ExcuseStudentSelection,
} from './AttendanceExcuseForm';

import type { School } from '@/types/school';
import type {
    SchoolMembership,
    SchoolMembershipsPage,
} from '@/types/school-membership';

interface Props {
    onSaved: () => void;
}

function todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const part = (name: string) =>
        parts.find((item) => item.type === name)?.value ?? '';

    return `${part('year')}-${part('month')}-${part('day')}`;
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
    const params = new URLSearchParams({
        schoolId: String(schoolId),
        type: 'STUDENT',
        q: query,
        page: '1',
        limit: '50',
    });

    const { data, loading, error, retry } =
        useApiQuery<SchoolMembershipsPage>(
            `/school-memberships?${params.toString()}`,
        );

    // Bir o‘quvchi sinf almashtirgan bo‘lishi mumkin.
    // Qidiruv ro‘yxatida uni takror ko‘rsatmaymiz.
    const uniqueStudents = new Map<number, SchoolMembership>();

    for (const membership of data?.data ?? []) {
        if (
            membership.person &&
            !uniqueStudents.has(membership.person.id)
        ) {
            uniqueStudents.set(membership.person.id, membership);
        }
    }

    return (
        <div className="space-y-2">
            {loading && (
                <p role="status" className="text-sm text-muted-foreground">
                    O‘quvchilar qidirilmoqda…
                </p>
            )}

            {error && (
                <div className="flex items-center gap-2">
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={retry}
                    >
                        Takrorlash
                    </Button>
                </div>
            )}

            {!loading && !error && uniqueStudents.size === 0 && (
                <p className="text-sm text-muted-foreground">
                    O‘quvchi topilmadi.
                </p>
            )}

            {uniqueStudents.size > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2">
                    {[...uniqueStudents.values()].map((membership) => {
                        const person = membership.person!;

                        const name = [
                            person.lastName,
                            person.firstName,
                            person.middleName,
                        ].filter(Boolean).join(' ');

                        return (
                            <button
                                key={person.id}
                                type="button"
                                onClick={() => onSelect(membership)}
                                className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="min-w-0">
                                    <span className="block font-medium">{name}</span>

                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        PNFL: {person.pnfl}
                                        {membership.schoolClass
                                            ? ` · ${membership.schoolClass.name}`
                                            : ''}
                                    </span>
                                </span>

                                <span className="shrink-0 text-xs font-semibold text-primary">
                                    Tanlash
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {data && data.total > 50 && (
                <p className="text-xs text-muted-foreground">
                    Birinchi 50 ta bog‘lanish tekshirildi.
                    Qidiruvni aniqlashtiring.
                </p>
            )}
        </div>
    );
}

export function CreateAttendanceExcuseDialog({
    onSaved,
}: Props) {
    const { session } = useAuth();

    const [open, setOpen] = useState(false);
    const [chosenSchoolId, setChosenSchoolId] = useState('');
    const [searchText, setSearchText] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [searchError, setSearchError] = useState('');

    const [student, setStudent] =
        useState<ExcuseStudentSelection | null>(null);

    const { data: schools, loading: schoolsLoading, error: schoolsError } =
        useApiQuery<School[]>('/schools');

    const profile = session?.profile;

    const schoolId =
        profile?.role === 'SCHOOL_ADMIN'
            ? String(profile.schoolId ?? '')
            : chosenSchoolId;

    const selectedSchool = (schools ?? []).find(
        (school) => String(school.id) === schoolId,
    );

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
            setSearchError('Kamida 2 ta belgi kiriting.');
            setAppliedSearch('');
            return;
        }

        setSearchError('');
        setStudent(null);
        setAppliedSearch(value);
    }

    function handleSelect(membership: SchoolMembership) {
        if (!membership.person || !selectedSchool) return;

        const person = membership.person;

        setStudent({
            personId: person.id,
            schoolId: selectedSchool.id,
            name: [
                person.lastName,
                person.firstName,
                person.middleName,
            ].filter(Boolean).join(' '),
            schoolName: selectedSchool.name,
            className: membership.schoolClass?.name ?? null,
            defaultDate: todayInTashkent(),
        });
    }

    function closeDialog() {
        setOpen(false);
        resetSelection();
    }

    function handleSaved() {
        closeDialog();
        onSaved();
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpen(true);
                } else {
                    closeDialog();
                }
            }}
        >
            <Dialog.Trigger asChild>
                <Button type="button">
                    <FilePlus2 className="size-4" />
                    Yangi ariza
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />

                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl outline-none sm:p-6"
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <Dialog.Title className="text-xl font-bold">
                                Yangi sababli ariza
                            </Dialog.Title>

                            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                                O‘quvchini tanlang va asoslovchi PDF hujjatni yuklang.
                            </Dialog.Description>
                        </div>

                        <Dialog.Close asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Yopish"
                            >
                                <X className="size-5" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {student ? (
                        <div className="space-y-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setStudent(null)}
                            >
                                Boshqa o‘quvchini tanlash
                            </Button>

                            <AttendanceExcuseForm
                                selection={student}
                                onSaved={handleSaved}
                                onCancel={closeDialog}
                            />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label
                                    htmlFor="new-excuse-school"
                                    className="text-sm font-semibold"
                                >
                                    Maktab *
                                </label>

                                <select
                                    id="new-excuse-school"
                                    value={schoolId}
                                    disabled={
                                        schoolsLoading ||
                                        profile?.role === 'SCHOOL_ADMIN'
                                    }
                                    onChange={(event) => {
                                        setChosenSchoolId(event.target.value);
                                        resetSelection();
                                    }}
                                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-60"
                                >
                                    <option value="">Maktabni tanlang</option>

                                    {(schools ?? []).map((school) => (
                                        <option key={school.id} value={school.id}>
                                            {school.district.name} / {school.name}
                                        </option>
                                    ))}
                                </select>

                                {schoolsError && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {schoolsError}
                                    </p>
                                )}
                            </div>

                            {selectedSchool && (
                                <form
                                    onSubmit={handleSearch}
                                    className="space-y-2"
                                >
                                    <label
                                        htmlFor="new-excuse-student-search"
                                        className="text-sm font-semibold"
                                    >
                                        O‘quvchini F.I.Sh. yoki PNFL orqali qidirish
                                    </label>

                                    <div className="flex gap-2">
                                        <Input
                                            id="new-excuse-student-search"
                                            type="search"
                                            value={searchText}
                                            maxLength={100}
                                            placeholder="Familiya, ism yoki PNFL"
                                            onChange={(event) => {
                                                setSearchText(event.target.value);
                                                setAppliedSearch('');
                                                setSearchError('');
                                            }}
                                        />

                                        <Button type="submit" variant="secondary">
                                            <Search className="size-4" />
                                            Qidirish
                                        </Button>
                                    </div>

                                    {searchError && (
                                        <p role="alert" className="text-sm text-destructive">
                                            {searchError}
                                        </p>
                                    )}
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

                            <p className="text-xs text-muted-foreground">
                                Tarixiy o‘quvchilik bog‘lanishlari ham qidiruvda
                                ko‘rinishi mumkin. Ariza sanasi o‘quvchining
                                shu maktabdagi o‘qish davriga mos bo‘lishi kerak.
                            </p>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
