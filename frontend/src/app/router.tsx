import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRole } from '@/components/auth/RequireRole';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ProfilePage } from '@/pages/cabinet/ProfilePage';
import { MySchoolsPage } from '@/pages/cabinet/MySchoolsPage';
import { SchoolsPage } from '@/pages/schools/SchoolsPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ADMIN_ROLES } from '@/lib/roles';
import { StudentsPage } from '@/pages/students/StudentsPage';
import { TeachersPage } from '@/pages/teachers/TeachersPage';
import { PersonDetailsPage } from '@/pages/persons/PersonDetailsPage';
import { TerminalsPage } from '@/pages/terminals/TerminalsPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { ClassesPage } from '@/pages/classes/ClassesPage';

export const router = createBrowserRouter([
    {
        element: <AuthLayout />,
        children: [
            { path: '/login', element: <LoginPage /> },
        ],
    },
    {
        element: <RequireAuth />,
        children: [
            {
                element: <DashboardLayout />,
                children: [
                    { path: '/', element: <Navigate to="/me" replace /> },
                    { path: '/me', element: <ProfilePage /> },
                    { path: '/me/schools', element: <MySchoolsPage /> },
                    { path: '/forbidden', element: <ForbiddenPage /> },
                    {
                        element: <RequireRole roles={ADMIN_ROLES} />,
                        children: [
                            { path: '/schools', element: <SchoolsPage /> },
                            { path: '/students', element: <StudentsPage /> },
                            { path: '/teachers', element: <TeachersPage /> },
                            {
                                path: '/persons/:id',
                                element: <PersonDetailsPage />,
                            },
                            {
                                path: '/terminals',
                                element: <TerminalsPage />,
                            },
                            {
                                path: '/attendance',
                                element: <AttendancePage />,
                            },
                            { path: '/classes', element: <ClassesPage /> },
                        ],
                    },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);