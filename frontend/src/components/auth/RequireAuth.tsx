import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth() {
    const { session } = useAuth();

    return session
        ? <Outlet />
        : <Navigate to="/login" replace />;
}