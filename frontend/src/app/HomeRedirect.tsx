import { Navigate } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { ADMIN_ROLES } from '@/lib/roles';

/** Kirgandan keyin har rol o‘z kabinetiga tushadi. */
export function HomeRedirect() {
    const { session } = useAuth();
    const role = session?.profile.role;
    // Administratorlar uchun bosh sahifa — dashboard.
    const to =
        role === 'TEACHER' ? '/teacher/dashboard' : role === 'STUDENT' ? '/student' : role && ADMIN_ROLES.includes(role) ? '/dashboard' : '/me';
    return <Navigate to={to} replace />;
}
