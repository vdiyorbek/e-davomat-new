import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CreateInspectorForm } from '@/components/inspector/CreateInspectorForm';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import type { AccessUser } from '@/components/users/UserAccessForm';
import { InspectorMahallasForm } from '@/components/users/InspectorMahallasForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';

const LIMIT = 20;

interface InspectorRow {
    id: number;
    login: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    isActive: boolean;
    district: { id: number; name: string } | null;
    mahallaCount: number;
    openCases: number;
}

interface InspectorsResponse {
    total: number;
    page: number;
    limit: number;
    items: InspectorRow[];
}

/** Uchastkavoylarni qo‘shish va mahallalarini boshqarish (faqat bosh, viloyat va tuman administratori). */
export function InspectorsManagePage() {
    const { t } = useTranslation();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<InspectorRow | null>(null);
    const [notice, setNotice] = useState('');

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) params.set('search', search);
    const query = useApiQuery<InspectorsResponse>(`/inspectors?${params.toString()}`);
    const data = query.data;

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = searchInput.trim();
        if (value.length === 1) return;
        setSearch(value);
        setPage(1);
    }

    const editUser: AccessUser | null = editing
        ? {
              id: editing.id,
              login: editing.login,
              role: 'MAHALLA_INSPECTOR',
              isActive: editing.isActive,
              scope: { regionId: null, districtId: editing.district?.id ?? null, schoolId: null },
              region: null,
              district: editing.district,
              school: null,
          }
        : null;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('inspectors.manage.title')}
                description={t('inspectors.manage.description')}
                actions={
                    <Button onClick={() => setCreating(true)}>
                        <Plus aria-hidden="true" />
                        {t('inspectors.manage.add')}
                    </Button>
                }
            />
            {notice && <SuccessNotice>{notice}</SuccessNotice>}

            <Card className="p-4 sm:p-5">
                <form onSubmit={handleSearch} className="flex max-w-xl gap-2">
                    <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('inspectors.manage.searchPlaceholder')}
                        aria-label={t('inspectors.students.search')}
                        maxLength={100}
                    />
                    <Button type="submit">{t('inspectors.students.apply')}</Button>
                </form>
            </Card>

            {query.loading && <LoadingState />}
            {query.error && <ErrorState message={query.error} onRetry={query.retry} />}
            {data && data.items.length === 0 && (
                <EmptyState title={t('inspectors.manage.emptyTitle')} description={t('inspectors.manage.empty')} />
            )}

            {data && data.items.length > 0 && (
                <>
                    <Card className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">{t('inspectors.students.name')}</TableHead>
                                    <TableHead>{t('profile.login')}</TableHead>
                                    <TableHead>{t('common.district')}</TableHead>
                                    <TableHead>{t('inspectors.manage.mahallaCount')}</TableHead>
                                    <TableHead>{t('inspectors.manage.openCases')}</TableHead>
                                    <TableHead>{t('inspectors.students.status')}</TableHead>
                                    <TableHead className="pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="pl-5 font-medium">
                                            {[row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ')}
                                        </TableCell>
                                        <TableCell>@{row.login}</TableCell>
                                        <TableCell>{row.district?.name ?? '—'}</TableCell>
                                        <TableCell className="tabular-nums">{row.mahallaCount}</TableCell>
                                        <TableCell className="tabular-nums">{row.openCases}</TableCell>
                                        <TableCell>
                                            <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
                                                {row.isActive ? t('inspectors.manage.active') : t('inspectors.manage.inactive')}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="pr-5 text-right">
                                            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                                                {t('inspectors.manage.editMahallas')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                    <Pagination
                        page={data.page}
                        totalPages={Math.max(1, Math.ceil(data.total / data.limit))}
                        onPageChange={setPage}
                        total={data.total}
                        pageSize={data.limit}
                        shownCount={data.items.length}
                    />
                </>
            )}

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('inspectors.manage.add')}</DialogTitle>
                        <DialogDescription>{t('inspectors.manage.addDescription')}</DialogDescription>
                    </DialogHeader>
                    {creating && (
                        <CreateInspectorForm
                            onCancel={() => setCreating(false)}
                            onCreated={() => {
                                setCreating(false);
                                setNotice(t('inspectors.manage.created'));
                                query.retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('inspectors.mahallas.title')}</DialogTitle>
                        <DialogDescription>@{editing?.login}</DialogDescription>
                    </DialogHeader>
                    {editUser && (
                        <InspectorMahallasForm
                            key={editUser.id}
                            user={editUser}
                            onCancel={() => setEditing(null)}
                            onUpdated={() => {
                                setEditing(null);
                                setNotice(t('inspectors.mahallas.saved'));
                                query.retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
