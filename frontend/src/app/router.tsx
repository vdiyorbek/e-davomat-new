import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRole } from '@/components/auth/RequireRole';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ProfilePage } from '@/pages/cabinet/ProfilePage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ADMIN_ROLES } from '@/lib/roles';

const SchoolsPage = lazy(() => import('@/pages/schools/SchoolsPage').then((m) => ({ default: m.SchoolsPage })));
const StudentsPage = lazy(() => import('@/pages/students/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const TeachersPage = lazy(() => import('@/pages/teachers/TeachersPage').then((m) => ({ default: m.TeachersPage })));
const PersonDetailsPage = lazy(() => import('@/pages/persons/PersonDetailsPage').then((m) => ({ default: m.PersonDetailsPage })));
const TerminalsPage = lazy(() => import('@/pages/terminals/TerminalsPage').then((m) => ({ default: m.TerminalsPage })));
const AttendancePage = lazy(() => import('@/pages/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const ClassesPage = lazy(() => import('@/pages/classes/ClassesPage').then((m) => ({ default: m.ClassesPage })));
const UsersPage = lazy(() => import('@/pages/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const AttendanceExcusesPage = lazy(() => import('@/pages/attendance/AttendanceExcusesPage').then((m) => ({ default: m.AttendanceExcusesPage })));
const StudentAttendancePage = lazy(() => import('@/pages/attendance/StudentAttendancePage').then((m) => ({ default: m.StudentAttendancePage })));
const TeacherAttendancePage = lazy(() => import('@/pages/attendance/TeacherAttendancePage').then((m) => ({ default: m.TeacherAttendancePage })));
const AttendanceCalendarPage = lazy(() => import('@/pages/attendance/AttendanceCalendarPage').then((m) => ({ default: m.AttendanceCalendarPage })));
const TeacherAssignmentsPage = lazy(() => import('@/pages/teacher-assignments/TeacherAssignmentsPage').then((m) => ({ default: m.TeacherAssignmentsPage })));
const TextbooksPage = lazy(() => import('@/pages/textbooks/TextbooksPage').then((m) => ({ default: m.TextbooksPage })));
const LessonSchedulesPage = lazy(() => import('@/pages/lesson-schedules/LessonSchedulesPage').then((m) => ({ default: m.LessonSchedulesPage })));
const JournalPage = lazy(() => import('@/pages/journal/JournalPage').then((m) => ({ default: m.JournalPage })));
const SubjectsPage = lazy(() => import('@/pages/subjects/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const TeacherDashboardPage = lazy(() =>
    import('@/pages/teacher-dashboard/TeacherDashboardPage')
        .then((m) => ({ default: m.TeacherDashboardPage }))
);

const TeacherJournalPage = lazy(() =>
    import('@/pages/teacher-dashboard/TeacherJournalPage')
        .then((m) => ({ default: m.TeacherJournalPage }))
);

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
                        element: <RequireRole roles={['TEACHER']} />,
                        children: [
                            {
                                path: '/teacher/dashboard',
                                element: <TeacherDashboardPage />,
                            },
                            {
                                path: '/teacher/journal/:assignmentId',
                                element: <TeacherJournalPage />,
                            },
                        ],
                    },
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
                            {
                                path: '/journal',
                                element: <JournalPage />,
                            },
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
                            {
                                path: '/lesson-schedules',
                                element: <LessonSchedulesPage />,
                            },
                            {
                                element: <RequireRole roles={['SUPER_ADMIN']} />,
                                children: [
                                    {
                                        path: '/textbooks',
                                        element: <TextbooksPage />,
                                    },
                                    {
                                        path: '/subjects',
                                        element: <SubjectsPage />,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);