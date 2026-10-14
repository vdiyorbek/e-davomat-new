
import { useState, useEffect } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import {
    UsersFilters,
    type UsersFilterValues,
} from '@/components/users/UsersFilters';
import {
    UserAccessForm,
    type AccessUser,
} from '@/components/users/UserAccessForm';
import { Button } from '@/components/ui/button';
import { CreateUserForm } from '@/components/users/CreateUserForm';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { UserRole } from '@/types/auth';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { EditUserForm } from '@/components/users/EditUserForm';
import type { EditableUser } from '@/components/users/EditUserForm';
import { authorizedGet } from '@/lib/auth-session';
import { UserStatusAction } from '@/components/users/UserStatusAction';
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

export function UsersPage() {
    const [showCreate, setShowCreate] = useState(false);
    const [notice, setNotice] = useState('');

    const { session } = useAuth();
    const isSuperAdmin =
        session?.profile.role === 'SUPER_ADMIN';
    const [accessUser, setAccessUser] =
        useState<AccessUser | null>(null);

    const [accessLoading, setAccessLoading] = useState(false);
    const [accessError, setAccessError] = useState('');

    const [filters, setFilters] = useState<UsersFilterValues>({
        search: '',
        role: '',
        isActive: '',
        regionId: '',
        districtId: '',
        schoolId: '',
    });

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // Ҳар бир ҳарф учун серверга сўров юбормаслик.
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(filters.search.trim());
        }, 350);

        return () => window.clearTimeout(timer);
    }, [filters.search]);

    function updateFilters(next: UsersFilterValues) {
        setFilters(next);
        setPage(1);
    }

    function resetFilters() {
        setFilters({
            search: '',
            role: '',
            isActive: '',
            regionId: '',
            districtId: '',
            schoolId: '',
        });
        setPage(1);
    }

    const canManageAccess = [
        'SUPER_ADMIN',
        'REGION_ADMIN',
        'DISTRICT_ADMIN',
    ].includes(session?.profile.role ?? '');

    async function openAccess(userId: number) {
        setAccessError('');
        setAccessLoading(true);

        try {
            const result = await authorizedGet<AccessUser>(
                `/users/${userId}`,
            );
            setAccessUser(result);
        } catch (error: unknown) {
            setAccessError(
                error instanceof Error
                    ? error.message
                    : 'Фойдаланувчини юклаб бўлмади.',
            );
        } finally {
            setAccessLoading(false);
        }
    }

    const [editingUser, setEditingUser] =
        useState<EditableUser | null>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    const params = new URLSearchParams();

    params.set('page', String(page));
    params.set('limit', String(limit));

    if (debouncedSearch) {
        params.set('search', debouncedSearch);
    }

    if (filters.role) {
        params.set('role', filters.role);
    }

    if (filters.isActive) {
        params.set('isActive', filters.isActive);
    }

    if (filters.regionId) {
        params.set('regionId', filters.regionId);
    }

    if (filters.districtId) {
        params.set('districtId', filters.districtId);
    }

    if (filters.schoolId) {
        params.set('schoolId', filters.schoolId);
    }

    const query = useApiQuery<UsersResponse>(
        `/users?${params.toString()}`,
    );

    function handleCreated() {
        setShowCreate(false);
        setNotice('Foydalanuvchi muvaffaqiyatli yaratildi.');
        query.retry();
    }
    async function openEdit(userId: number) {
        setEditError('');
        setEditLoading(true);

        try {
            const user = await authorizedGet<EditableUser>(
                `/users/${userId}`,
            );
            setEditingUser(user);
        } catch (error: unknown) {
            setEditError(
                error instanceof Error
                    ? error.message
                    : 'Ma’lumotlarni yuklab bo‘lmadi.',
            );
        } finally {
            setEditLoading(false);
        }
    }
    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Foydalanuvchilar
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Tizim foydalanuvchilarini boshqarish
                    </p>
                </div>

                <Button onClick={() => {
                    setShowCreate(true);
                    setNotice('');
                }}>
                    <Plus className="mr-2 size-4" />
                    Foydalanuvchi qo‘shish
                </Button>
                <UsersFilters
                    value={filters}
                    onChange={updateFilters}
                    onReset={resetFilters}
                />
            </div>

            {notice && (
                <p role="status" className="text-sm text-green-600">
                    {notice}
                </p>
            )}

            {showCreate && (
                <div className="space-y-5 rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">
                        Yangi foydalanuvchi
                    </h2>

                    <CreateUserForm
                        onCreated={handleCreated}
                        onCancel={() => setShowCreate(false)}
                    />
                </div>
            )}

            {query.loading ? (
                <p>Foydalanuvchilar yuklanmoqda...</p>
            ) : query.error ? (
                <div className="space-y-3">
                    <p role="alert" className="text-destructive">
                        {query.error}
                    </p>
                    <Button variant="outline" onClick={query.retry}>
                        Qayta urinish
                    </Button>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    {editError && (
                        <p role="alert" className="text-sm text-destructive">
                            {editError}
                        </p>
                    )}

                    {editingUser && (
                        <section className="rounded-2xl border bg-card p-5 sm:p-6">
                            <h2 className="mb-5 text-lg font-semibold">
                                Foydalanuvchini tahrirlash
                            </h2>

                            <EditUserForm
                                key={editingUser.id}
                                user={editingUser}
                                onCancel={() => setEditingUser(null)}
                                onUpdated={() => {
                                    setEditingUser(null);
                                    setNotice('Foydalanuvchi yangilandi.');
                                    query.retry();
                                }}
                            />
                        </section>
                    )}

                    {accessError && (
                        <p role="alert" className="text-sm text-destructive">
                            {accessError}
                        </p>
                    )}

                    {accessUser && (
                        <section className="rounded-2xl border bg-card p-5 sm:p-6">
                            <h2 className="mb-5 text-lg font-semibold">
                                Рол ва ҳудудий ваколат
                            </h2>

                            <UserAccessForm
                                key={accessUser.id}
                                user={accessUser}
                                onCancel={() => setAccessUser(null)}
                                onUpdated={() => {
                                    setAccessUser(null);
                                    setNotice('Фойдаланувчи ваколати янгиланди.');
                                    query.retry();
                                }}
                            />
                        </section>
                    )}

                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-4">F.I.Sh.</th>
                                <th className="p-4">Login</th>
                                <th className="p-4">Rol</th>
                                <th className="p-4">Maktab</th>
                                <th className="p-4">Holat</th>
                                <th className="p-4">Amallar</th>
                            </tr>
                        </thead>

                        <tbody>
                            {query.data?.data.map((user) => (
                                <tr key={user.id} className="border-t">
                                    <td className="p-4 font-medium">
                                        {user.fullName}
                                    </td>
                                    <td className="p-4">{user.login}</td>
                                    <td className="p-4">{user.role}</td>
                                    <td className="p-4">
                                        {user.school?.name ?? '—'}
                                    </td>
                                    <td className="p-4">
                                        {user.isActive ? 'Faol' : 'Bloklangan'}
                                    </td>
                                    <td className="p-4">
                                        {session?.profile.role === 'SUPER_ADMIN' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={editLoading}
                                                onClick={() => void openEdit(user.id)}
                                            >
                                                <Pencil className="mr-2 size-4" />
                                                Tahrirlash
                                            </Button>
                                        )}

                                        {canManageAccess &&
                                            user.id !== session?.profile.id &&
                                            user.isActive &&
                                            !(
                                                session?.profile.role === 'REGION_ADMIN' &&
                                                ['REGION_ADMIN', 'SUPER_ADMIN'].includes(user.role)
                                            ) &&
                                            !(
                                                session?.profile.role === 'DISTRICT_ADMIN' &&
                                                !['USER', 'SCHOOL_ADMIN'].includes(user.role)
                                            ) && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={accessLoading}
                                                    onClick={() => void openAccess(user.id)}
                                                >
                                                    <ShieldCheck className="mr-2 size-4" />
                                                    Рол ва ваколат
                                                </Button>
                                            )}
                                        {isSuperAdmin && session && (
                                            <UserStatusAction
                                                key={`${user.id}-${user.isActive}`}
                                                user={user}
                                                currentUserId={session.profile.id}
                                                onUpdated={(message) => {
                                                    setNotice(message);
                                                    query.retry();
                                                }}
                                            />
                                        )}

                                    </td>
                                </tr>
                            ))}
                            {query.data?.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="p-6 text-center text-muted-foreground"
                                    >
                                        Foydalanuvchilar topilmadi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {!query.loading && !query.error && query.data && (
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
                            <div className="text-sm text-muted-foreground">
                                Жами: <strong>{query.data.total}</strong> та фойдаланувчи
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <label htmlFor="users-page-size" className="text-sm">
                                    Саҳифада:
                                </label>

                                <select
                                    id="users-page-size"
                                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>

                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Олдинги
                                </Button>

                                <span className="text-sm tabular-nums">
                                    {query.data.page} / {Math.max(1, query.data.totalPages)}
                                </span>

                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page >= query.data.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Кейинги
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
