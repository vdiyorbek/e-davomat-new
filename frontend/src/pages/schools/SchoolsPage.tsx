import { useId, useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { SchoolForm } from '@/components/schools/SchoolForm';
import { SchoolMembersLinks } from '@/components/schools/SchoolMembersLinks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import type { CreatedSchool, School } from '@/types/school';

function normalizeSearch(value: string): string {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/['‘’ʻʼ`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function SchoolList({ schools, onEdit }: { schools: School[]; onEdit?: (school: School) => void }) {
    const { t } = useTranslation();

    function editButton(school: School, full = false) {
        if (!onEdit) return null;
        return (
            <Button
                type="button"
                variant="ghost"
                size={full ? 'sm' : 'icon-sm'}
                className={full ? undefined : 'size-8'}
                onClick={() => onEdit(school)}
                aria-label={`${school.name} — ${t('common.edit')}`}
            >
                <Pencil aria-hidden="true" />
                {full && t('common.edit')}
            </Button>
        );
    }

    return (
        <>
            <ul aria-label={t('schools.listLabel')} className="grid min-w-0 list-none gap-3 sm:grid-cols-2 xl:hidden">
                {schools.map((school) => (
                    <li key={school.id}>
                        <Card size="sm" className="h-full gap-3 px-4">
                            <div className="flex items-start gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                    <Building2 aria-hidden="true" className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm leading-5 font-semibold [overflow-wrap:anywhere]">{school.name}</h2>
                                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                                        <MapPin aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                                        <span>
                                            {school.district.region.name} / {school.district.name}
                                        </span>
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">#{school.id}</span>
                            </div>
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                <SchoolMembersLinks schoolId={school.id} schoolName={school.name} />
                                {editButton(school, true)}
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>

            <Card className="hidden py-0 xl:flex">
                <Table className="min-w-[860px]">
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-20 pl-5">ID</TableHead>
                            <TableHead>{t('schools.name')}</TableHead>
                            <TableHead>{t('common.district')}</TableHead>
                            <TableHead>{t('common.region')}</TableHead>
                            <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schools.map((school) => (
                            <TableRow key={school.id}>
                                <TableCell className="pl-5 text-muted-foreground tabular-nums">{school.id}</TableCell>
                                <TableCell className="max-w-80 font-semibold whitespace-normal">{school.name}</TableCell>
                                <TableCell className="whitespace-normal">{school.district.name}</TableCell>
                                <TableCell className="whitespace-normal">{school.district.region.name}</TableCell>
                                <TableCell className="pr-5">
                                    <div className="flex items-center justify-end gap-2">
                                        <SchoolMembersLinks schoolId={school.id} schoolName={school.name} className="flex-nowrap" />
                                        {editButton(school)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </>
    );
}

export function SchoolsPage() {
    const { t } = useTranslation();
    const searchId = useId();
    const { data, loading, error, retry } = useApiQuery<School[]>('/schools');
    const { session } = useAuth();
    const [search, setSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    const canCreate = session?.profile.role === 'SUPER_ADMIN';
    const schools = data ?? [];
    const terms = normalizeSearch(search).split(' ').filter(Boolean);
    const filtered = schools.filter((school) => {
        const text = normalizeSearch([school.id, school.name, school.district.name, school.district.region.name].join(' '));
        return terms.every((term) => text.includes(term));
    });

    function handleSaved(school: CreatedSchool) {
        const wasEditing = editingSchool !== null;
        setFormOpen(false);
        setEditingSchool(null);
        setSearch('');
        setSuccessMessage(wasEditing ? t('schools.updated', { name: school.name }) : t('schools.created', { name: school.name }));
        retry();
    }

    function openForm(school: School | null) {
        setSuccessMessage('');
        setEditingSchool(school);
        setFormOpen(true);
    }

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.education')}
                title={t('schools.title')}
                description={t('schools.subtitle')}
                actions={
                    canCreate ? (
                        <Button type="button" className="w-full sm:w-auto" onClick={() => openForm(null)}>
                            <Plus aria-hidden="true" />
                            {t('schools.add')}
                        </Button>
                    ) : undefined
                }
            />

            {successMessage && <SuccessNotice>{successMessage}</SuccessNotice>}

            {loading ? (
                <LoadingState label={t('schools.loading')} />
            ) : error ? (
                <ErrorState title={t('schools.loadFailed')} message={error} onRetry={retry} />
            ) : schools.length === 0 ? (
                <EmptyState icon={Building2} title={t('schools.emptyTitle')} description={t('schools.empty')} />
            ) : (
                <>
                    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="relative w-full min-w-0 sm:max-w-md">
                            <label htmlFor={searchId} className="sr-only">
                                {t('schools.search')}
                            </label>
                            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id={searchId}
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('schools.searchPlaceholder')}
                                className="pr-11 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
                            />
                            {search && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('common.clearSearch')}
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2"
                                >
                                    <X aria-hidden="true" />
                                </Button>
                            )}
                        </div>
                        <p role="status" aria-live="polite" className="shrink-0 text-sm text-muted-foreground tabular-nums">
                            {terms.length
                                ? t('schools.found', { found: filtered.length, total: schools.length })
                                : t('schools.total', { total: schools.length })}
                        </p>
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={Search}
                            title={t('schools.noMatchTitle')}
                            description={t('schools.noMatch')}
                            action={
                                <Button variant="outline" onClick={() => setSearch('')}>
                                    {t('common.clearSearch')}
                                </Button>
                            }
                        />
                    ) : (
                        <SchoolList schools={filtered} {...(canCreate ? { onEdit: (school: School) => openForm(school) } : {})} />
                    )}
                </>
            )}

            {canCreate && (
                <Dialog
                    open={formOpen}
                    onOpenChange={(open) => {
                        setFormOpen(open);
                        if (!open) setEditingSchool(null);
                    }}
                >
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingSchool ? t('schools.editTitle') : t('schools.createTitle')}</DialogTitle>
                            <DialogDescription>{editingSchool ? t('schools.editHint') : t('schools.createHint')}</DialogDescription>
                        </DialogHeader>
                        <SchoolForm
                            key={editingSchool?.id ?? 'create'}
                            {...(editingSchool ? { school: editingSchool } : {})}
                            onSaved={handleSaved}
                            onCancel={() => {
                                setFormOpen(false);
                                setEditingSchool(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
