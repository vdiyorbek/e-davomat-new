import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SelectField } from '@/components/common/SelectField';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CreateUserForm } from '@/components/users/CreateUserForm';
import { EditUserForm } from '@/components/users/EditUserForm';
import type { EditableUser } from '@/components/users/EditUserForm';
import { UserAccessForm } from '@/components/users/UserAccessForm';
import type { AccessUser } from '@/components/users/UserAccessForm';
import { UsersFilters } from '@/components/users/UsersFilters';
import type { UsersFilterValues } from '@/components/users/UsersFilters';
import { UserStatusDialog } from '@/components/users/UserStatusAction';
import type { StatusUser } from '@/components/users/UserStatusAction';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedGet } from '@/lib/auth-session';
import type { UserRole } from '@/types/auth';

interface UserItem {
    id: number;
    login: string;
    fullName: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    role: UserRole;
    isActive: boolean;
    school: { id: number; name: string } | null;
}

interface UsersResponse {
    data: UserItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const EMPTY_FILTERS: UsersFilterValues = { search: '', role: '', isActive: '', regionId: '', districtId: '', schoolId: '' };

function initials(user: UserItem) {
    const parts = (user.fullName || user.login).split(/\s+/).filter(Boolean);
    return ((parts[1]?.[0] ?? '') + (parts[0]?.[0] ?? '')).toUpperCase() || user.login.slice(0, 2).toUpperCase();
}

export function UsersPage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    const profile = session?.profile;
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    const canManageAccess = ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN'].includes(profile?.role ?? '');

    const [filters, setFilters] = useState<UsersFilterValues>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');

    const [showCreate, setShowCreate] = useState(false);
    const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
    const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
    const [statusUser, setStatusUser] = useState<StatusUser | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);

    // Har bir harf uchun serverga so‘rov yubormaslik.
    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
        return () => window.clearTimeout(timer);
    }, [filters.search]);

    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    for (const key of ['role', 'isActive', 'regionId', 'districtId', 'schoolId'] as const) {
        if (filters[key]) params.set(key, filters[key]);
    }
    const query = useApiQuery<UsersResponse>(`/users?${params.toString()}`);

    async function load<T>(userId: number, onLoaded: (value: T) => void) {
        setActionError('');
        setLoadingId(userId);
        try {
            onLoaded(await authorizedGet<T>(`/users/${userId}`));
        } catch (error: unknown) {
            setActionError(error instanceof Error ? error.message : t('common.loadFailed'));
        } finally {
            setLoadingId(null);
        }
    }

    function canEditAccess(user: UserItem) {
        return (
            canManageAccess &&
            user.id !== profile?.id &&
            user.isActive &&
            !(profile?.role === 'REGION_ADMIN' && ['REGION_ADMIN', 'SUPER_ADMIN'].includes(user.role)) &&
            !(profile?.role === 'DISTRICT_ADMIN' && !['USER', 'SCHOOL_ADMIN'].includes(user.role))
        );
    }

    function canChangeStatus(user: UserItem) {
        return isSuperAdmin && user.id !== profile?.id && user.role !== 'SUPER_ADMIN';
    }

    function actionsMenu(user: UserItem) {
        const items = [isSuperAdmin, canEditAccess(user), canChangeStatus(user)];
        if (!items.some(Boolean)) return null;

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-8"
                        disabled={loadingId === user.id}
                        aria-label={`${t('common.actions')}: ${user.fullName || user.login}`}
                    >
                        <MoreHorizontal aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                    {isSuperAdmin && (
                        <DropdownMenuItem onSelect={() => void load<EditableUser>(user.id, setEditingUser)}>
                            <Pencil aria-hidden="true" />
                            {t('common.edit')}
                        </DropdownMenuItem>
                    )}
                    {canEditAccess(user) && (
                        <DropdownMenuItem onSelect={() => void load<AccessUser>(user.id, setAccessUser)}>
                            <ShieldCheck aria-hidden="true" />
                            {t('users.access.title')}
                        </DropdownMenuItem>
                    )}
                    {canChangeStatus(user) && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant={user.isActive ? 'destructive' : 'default'}
                                onSelect={() => setStatusUser(user)}
                            >
                                {user.isActive ? <Ban aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                                {user.isActive ? t('users.status.block') : t('users.status.activate')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    function statusBadge(user: UserItem) {
        return <StatusBadge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? t('users.active') : t('users.blocked')}</StatusBadge>;
    }

    const data = query.data;

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.system')}
                title={t('users.title')}
                description={t('users.subtitle')}
                actions={
                    <Button
                        type="button"
                        className="w-full sm:w-auto"
                        onClick={() => {
                            setShowCreate(true);
                            setNotice('');
                        }}
                    >
                        <Plus aria-hidden="true" />
                        {t('users.add')}
                    </Button>
                }
            />

            <UsersFilters
                value={filters}
                onChange={(next) => {
                    setFilters(next);
                    setPage(1);
                }}
                onReset={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                }}
            />

            {notice && <SuccessNotice>{notice}</SuccessNotice>}
            {actionError && <ErrorState message={actionError} />}

            {query.loading ? (
                <LoadingState label={t('users.loading')} />
            ) : query.error ? (
                <ErrorState message={query.error} onRetry={query.retry} />
            ) : !data || data.data.length === 0 ? (
                <EmptyState icon={UserCog} title={t('users.emptyTitle')} description={t('users.empty')} />
            ) : (
                <>
                    <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                        {data.data.map((user) => (
                            <li key={user.id}>
                                <Card size="sm" className="flex-row items-center gap-3 px-4">
                                    <Avatar size="lg">
                                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(user)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="truncate font-semibold">{user.fullName || user.login}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            @{user.login} · {t(`roles.${user.role}`)}
                                        </p>
                                        {user.school && <p className="truncate text-xs text-muted-foreground">{user.school.name}</p>}
                                        {statusBadge(user)}
                                    </div>
                                    {actionsMenu(user)}
                                </Card>
                            </li>
                        ))}
                    </ul>

                    <Card className="hidden py-0 xl:flex">
                        <Table className="min-w-[820px]">
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-5">{t('common.fullName')}</TableHead>
                                    <TableHead>{t('profile.login')}</TableHead>
                                    <TableHead>{t('users.role')}</TableHead>
                                    <TableHead>{t('common.school')}</TableHead>
                                    <TableHead>{t('common.status')}</TableHead>
                                    <TableHead className="w-16 pr-5 text-right">
                                        <span className="sr-only">{t('common.actions')}</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="pl-5">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">{initials(user)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-semibold">{user.fullName || '—'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{user.login}</TableCell>
                                        <TableCell>{t(`roles.${user.role}`)}</TableCell>
                                        <TableCell className="max-w-60 whitespace-normal">{user.school?.name ?? '—'}</TableCell>
                                        <TableCell>{statusBadge(user)}</TableCell>
                                        <TableCell className="pr-5 text-right">{actionsMenu(user)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Pagination
                            className="flex-1"
                            page={data.page}
                            totalPages={Math.max(1, data.totalPages)}
                            onPageChange={setPage}
                            total={data.total}
                            pageSize={data.limit}
                            shownCount={data.data.length}
                        />
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-sm text-muted-foreground">{t('attendance.perPage')}</span>
                            <SelectField
                                value={String(limit)}
                                onValueChange={(value) => {
                                    setLimit(Number(value));
                                    setPage(1);
                                }}
                                options={['10', '20', '50', '100'].map((value) => ({ value, label: value }))}
                                aria-label={t('attendance.perPage')}
                                className="h-10 w-20"
                            />
                        </div>
                    </div>
                </>
            )}

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('users.createTitle')}</DialogTitle>
                        <DialogDescription>{t('users.createHint')}</DialogDescription>
                    </DialogHeader>
                    <CreateUserForm
                        onCreated={() => {
                            setShowCreate(false);
                            setNotice(t('users.created'));
                            query.retry();
                        }}
                        onCancel={() => setShowCreate(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('users.editTitle')}</DialogTitle>
                        <DialogDescription>@{editingUser?.login}</DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <EditUserForm
                            key={editingUser.id}
                            user={editingUser}
                            onCancel={() => setEditingUser(null)}
                            onUpdated={() => {
                                setEditingUser(null);
                                setNotice(t('users.updated'));
                                query.retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={accessUser !== null} onOpenChange={(open) => !open && setAccessUser(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('users.access.title')}</DialogTitle>
                        <DialogDescription>{t('users.access.hint')}</DialogDescription>
                    </DialogHeader>
                    {accessUser && (
                        <UserAccessForm
                            key={accessUser.id}
                            user={accessUser}
                            onCancel={() => setAccessUser(null)}
                            onUpdated={() => {
                                setAccessUser(null);
                                setNotice(t('users.access.updated'));
                                query.retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <UserStatusDialog
                user={statusUser}
                onClose={() => setStatusUser(null)}
                onUpdated={(message) => {
                    setNotice(message);
                    query.retry();
                }}
            />
        </div>
    );
}
