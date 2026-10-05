import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";

export function RequireRole({ roles }: { roles: UserRole[] }) {
    const { session } = useAuth()
    if (!session) return <Navigate to="/login" replace />

    return roles.includes(session.profile.role) ? <Outlet /> : <Navigate to="/forbidden" replace />
}