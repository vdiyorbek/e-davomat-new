import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth() {
    const { session } = useAuth();
    const { pathname } = useLocation();

    if (!session) return <Navigate to="/login" replace />;

    // Vaqtinchalik parol bilan kirgan foydalanuvchi avval parolni almashtiradi.
    if (session.profile.mustChangePassword && pathname !== '/me') {
        return <Navigate to="/me" replace />;
    }

    return <Outlet />;
}
