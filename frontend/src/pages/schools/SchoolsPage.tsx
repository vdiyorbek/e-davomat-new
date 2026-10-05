import { useId, useState } from 'react';
import { AlertCircle, Building2, MapPin, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { School } from '@/types/school';
import { useAuth } from '@/hooks/useAuth';
import type { CreatedSchool } from '@/types/school';
import { SchoolForm } from '@/components/schools/SchoolForm';
import { SchoolMembersLinks } from '@/components/schools/SchoolMembersLinks';

function normalizeSearch(value: string): string {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/['‘’ʻʼ`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function LoadingList() {
    return (
        <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Maktablar yuklanmoqda…</span>
            {[0, 1, 2].map((item) => (
                <div key={item} aria-hidden="true" className="space-y-3 rounded-xl border bg-background p-5 motion-safe:animate-pulse">
                    <div className="h-5 w-2/3 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
            ))}
        </div>
    );
}

interface SchoolListProps {
    schools: School[];
    onEdit?: (school: School) => void;
    editDisabled?: boolean;
}

function SchoolList({ schools, onEdit, editDisabled = false }: SchoolListProps) {

    return (
        <>
            <ul aria-label="Maktablar ro‘yxati" className="grid min-w-0 list-none gap-4 md:hidden">
                {schools.map((school) => (

                    <li key={school.id} className="min-w-0 rounded-2xl border bg-background p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Building2 aria-hidden="true" className="size-5" />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">ID: {school.id}</span>
                        </div>
                        <h2 className="text-base font-semibold leading-6 [overflow-wrap:anywhere]">{school.name}</h2>
                        <div className="mt-4 flex items-start gap-2 border-t pt-4">
                            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <dl className="min-w-0 space-y-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">Tuman / shahar</dt>
                                    <dd className="mt-1 leading-6 [overflow-wrap:anywhere]">{school.district.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">Viloyat</dt>
                                    <dd className="mt-1 leading-6 [overflow-wrap:anywhere]">{school.district.region.name}</dd>
                                </div>
                            </dl>
                        </div>
                        <div className="mt-5 space-y-2">
                            <SchoolMembersLinks
                                schoolId={school.id}
                                schoolName={school.name}
                            />

                            {onEdit && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={editDisabled}
                                    onClick={() => onEdit(school)}
                                    aria-label={`${school.name} — tahrirlash`}
                                    className="min-h-11 w-full"
                                >
                                    Tahrirlash
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            <div className="hidden min-w-0 overflow-hidden rounded-2xl border bg-background md:block">
                <div role="region" aria-label="Maktablar jadvali, zarur bo‘lsa yon tomonga suring" tabIndex={0}
                    className="max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
                        <caption className="sr-only">Boshqaruv doirangizdagi maktablar ro‘yxati</caption>
                        <colgroup>
                            <col className="w-20" />
                            <col className="w-[40%]" />
                            <col />
                            <col />
                        </colgroup>
                        <col className="w-72" />
                        <thead className="border-b bg-muted/50 text-muted-foreground">
                            <tr>
                                <th scope="col" className="px-5 py-4 font-medium">ID</th>
                                <th scope="col" className="px-5 py-4 font-medium">Maktab nomi</th>
                                <th scope="col" className="px-5 py-4 font-medium">Tuman / shahar</th>
                                <th scope="col" className="px-5 py-4 font-medium">Viloyat</th>
                                <th scope="col" className="px-5 py-4 font-medium">
                                    Amallar
                                </th>
                            </tr>

                        </thead>
                        <tbody>
                            {schools.map((school) => (
                                <tr key={school.id} className="border-b align-top last:border-0 hover:bg-muted/30">
                                    <td className="px-5 py-5 tabular-nums text-muted-foreground [overflow-wrap:anywhere]">{school.id}</td>
                                    <th scope="row" className="px-5 py-5 font-medium leading-6 [overflow-wrap:anywhere]">{school.name}</th>
                                    <td className="px-5 py-5 leading-6 [overflow-wrap:anywhere]">{school.district.name}</td>
                                    <td className="px-5 py-5 leading-6 [overflow-wrap:anywhere]">{school.district.region.name}</td>
                                    <td className="px-5 py-4">
                                        <div className="space-y-2">
                                            <SchoolMembersLinks
                                                schoolId={school.id}
                                                schoolName={school.name}
                                            />

                                            {onEdit && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={editDisabled}
                                                    onClick={() => onEdit(school)}
                                                    aria-label={`${school.name} — tahrirlash`}
                                                    className="min-h-11 w-full"
                                                >
                                                    Tahrirlash
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}


export function SchoolsPage() {
    const { data, loading, error, retry } = useApiQuery<School[]>('/schools');
    const [search, setSearch] = useState('');
    const searchId = useId();
    const schools = data ?? [];
    const terms = normalizeSearch(search).split(' ').filter(Boolean);
    const filtered = schools.filter((school) => {
        const text = normalizeSearch([
            school.id,
            school.name,
            school.district.name,
            school.district.region.name,
        ].join(' '));
        return terms.every((term) => text.includes(term));
    });

    const { session } = useAuth()

    const [showCreateForm, setShowCreateForm] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    const canCreate = session?.profile.role === 'SUPER_ADMIN'


    const [editingSchool, setEditingSchool] = useState<School | null>(
        null,
    );

    function handleSaved(school: CreatedSchool) {
        const wasEditing = editingSchool !== null;

        setShowCreateForm(false);
        setEditingSchool(null);
        setSearch('');

        setSuccessMessage(
            wasEditing
                ? `“${school.name}” ma’lumotlari yangilandi.`
                : `“${school.name}” muvaffaqiyatli qo‘shildi.`,
        );

        retry();
    }

    function handleEdit(school: School) {
        setSuccessMessage('');
        setShowCreateForm(false);
        setEditingSchool(school);

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }
    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Maktablar</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Boshqaruv doirangizdagi maktablar.</p>
            </div>
            {successMessage && (
                <p
                    role="status"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300"
                >
                    {successMessage}
                </p>
            )}

            {canCreate && !showCreateForm && !editingSchool && (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => {
                            setSuccessMessage('');
                            setShowCreateForm(true);
                        }}
                    >
                        Maktab qo‘shish
                    </Button>
                </div>
            )}

            {canCreate && (showCreateForm || editingSchool) && (
                <section
                    aria-labelledby="school-form-title"
                    className="min-w-0 rounded-2xl border bg-background p-5 sm:p-6"
                >
                    <div className="mb-6">
                        <h2
                            id="school-form-title"
                            className="text-lg font-semibold"
                        >
                            {editingSchool
                                ? 'Maktabni tahrirlash'
                                : 'Yangi maktab'}
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground">
                            {editingSchool
                                ? 'Maktab nomi yoki joylashgan tumanini yangilang.'
                                : 'Viloyat va tumanni tanlab, maktab nomini kiriting.'}
                        </p>
                    </div>

                    <SchoolForm
                        key={editingSchool?.id ?? 'create'}
                        {...(editingSchool ? { school: editingSchool } : {})}
                        onSaved={handleSaved}
                        onCancel={() => {
                            setShowCreateForm(false);
                            setEditingSchool(null);
                        }}
                    />
                </section>
            )}

            {loading ? (
                <LoadingList />
            ) : error ? (
                <div role="alert" className="rounded-2xl border border-destructive/30 bg-background p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                        <div className="min-w-0">
                            <h2 className="font-semibold">Maktablarni yuklab bo‘lmadi</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={retry} className="mt-5 min-h-11 w-full sm:w-auto">
                        <RefreshCw aria-hidden="true" className="size-4" />
                        Qayta urinish
                    </Button>
                </div>
            ) : schools.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-background px-5 py-12 text-center">
                    <Building2 aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
                    <h2 className="mt-4 font-semibold">Maktablar topilmadi</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Hozircha boshqaruv doirangizda ko‘rsatiladigan maktab yo‘q.</p>
                </div>
            ) : (
                <>
                    <div className="rounded-2xl border bg-background p-4 sm:p-5">
                        <label htmlFor={searchId} className="text-sm font-medium">Maktab qidirish</label>
                        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full min-w-0 lg:max-w-lg">
                                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground" />
                                <input
                                    id={searchId}
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Nomi, ID, tuman yoki viloyat…"
                                    className="h-12 w-full min-w-0 rounded-xl border bg-background pl-10 pr-12 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
                                />
                                {search && (
                                    <button type="button" aria-label="Qidiruvni tozalash" onClick={() => setSearch('')}
                                        className="absolute right-1 top-0.5 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <X aria-hidden="true" className="size-4" />
                                    </button>
                                )}
                            </div>
                            <p role="status" aria-live="polite" aria-atomic="true" className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                {terms.length ? `${schools.length} tadan ${filtered.length} ta topildi` : `Jami: ${schools.length} ta maktab`}
                            </p>
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-2xl border border-dashed bg-background px-5 py-10 text-center">
                            <Search aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
                            <h2 className="mt-4 font-semibold">Qidiruvga mos maktab topilmadi</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Boshqa nom yoki hudud bilan qidirib ko‘ring.</p>
                            <Button variant="outline" onClick={() => setSearch('')} className="mt-5 min-h-11">Qidiruvni tozalash</Button>
                        </div>
                    ) : (
                        <SchoolList
                            schools={filtered}
                            {...(canCreate ? { onEdit: handleEdit } : {})}
                            editDisabled={showCreateForm || editingSchool !== null}
                        />
                    )}
                </>
            )}
        </div>
    );
}