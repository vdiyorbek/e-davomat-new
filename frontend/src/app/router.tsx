import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRole } from '@/components/auth/RequireRole';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ProfilePage } from '@/pages/cabinet/ProfilePage';
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
import { UsersPage } from '@/pages/users/UsersPage';
import { AttendanceExcusesPage } from '@/pages/attendance/AttendanceExcusesPage';
import { StudentAttendancePage } from '@/pages/attendance/StudentAttendancePage';
import { TeacherAttendancePage } from '@/pages/attendance/TeacherAttendancePage';
import { AttendanceCalendarPage } from '@/pages/attendance/AttendanceCalendarPage';
import { TeacherAssignmentsPage } from '@/pages/teacher-assignments/TeacherAssignmentsPage';

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
                            {
                                path: '/attendance/students',
                                element: <StudentAttendancePage />,
                            },
                            {
                                path: '/attendance/teachers',
                                element: <TeacherAttendancePage />,
                            },
                            {
                                path: '/attendance/calendar',
                                element: <AttendanceCalendarPage />,
                            },
                            { path: '/classes', element: <ClassesPage /> },
                            { path: '/users', element: <UsersPage /> },
                            {
                                element: (
                                    <RequireRole roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']} />
                                ),
                                children: [
                                    {
                                        path: '/attendance-excuses',
                                        element: <AttendanceExcusesPage />,
                                    },
                                ],
                            },
                            {
                                path: '/teacher-assignments',
                                element: <TeacherAssignmentsPage />,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);