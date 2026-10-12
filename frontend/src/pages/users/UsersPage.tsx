
import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CreateUserForm } from '@/components/users/CreateUserForm';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { UserRole } from '@/types/auth';

interface UserItem {
    id: number;
    login: string;
    fullName: string;
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

    const query = useApiQuery<UsersResponse>(
        '/users?page=1&limit=20',
    );

    function handleCreated() {
        setShowCreate(false);
        setNotice('Foydalanuvchi muvaffaqiyatli yaratildi.');
        query.retry();
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
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
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-4">F.I.Sh.</th>
                                <th className="p-4">Login</th>
                                <th className="p-4">Rol</th>
                                <th className="p-4">Maktab</th>
                                <th className="p-4">Holat</th>
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
                                </tr>
                            ))}
                            {query.data?.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="p-6 text-center text-muted-foreground"
                                    >
                                        Foydalanuvchilar topilmadi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
