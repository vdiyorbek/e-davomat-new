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
import { ADMIN_ROLES, TALK_VIEW_ROLES } from '@/lib/roles';
import { HomeRedirect } from '@/app/HomeRedirect';

const TeacherTimetablePage = lazy(() => import('@/pages/teacher-dashboard/TeacherTimetablePage').then((m) => ({ default: m.TeacherTimetablePage })));
const TeacherAssessmentsPage = lazy(() => import('@/pages/assessments/TeacherAssessmentsPage').then((m) => ({ default: m.TeacherAssessmentsPage })));
const TeacherAssessmentPage = lazy(() => import('@/pages/assessments/TeacherAssessmentPage').then((m) => ({ default: m.TeacherAssessmentPage })));
const StudentHomePage = lazy(() => import('@/pages/student/StudentHomePage').then((m) => ({ default: m.StudentHomePage })));
const StudentSchedulePage = lazy(() => import('@/pages/student/StudentSchedulePage').then((m) => ({ default: m.StudentSchedulePage })));
const StudentOwnAttendancePage = lazy(() => import('@/pages/student/StudentOwnAttendancePage').then((m) => ({ default: m.StudentOwnAttendancePage })));
const StudentAssessmentsPage = lazy(() => import('@/pages/student/StudentAssessmentsPage').then((m) => ({ default: m.StudentAssessmentsPage })));
const StudentTestPage = lazy(() => import('@/pages/student/StudentTestPage').then((m) => ({ default: m.StudentTestPage })));
const SchoolsPage = lazy(() => import('@/pages/schools/SchoolsPage').then((m) => ({ default: m.SchoolsPage })));
const StudentsPage = lazy(() => import('@/pages/students/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const TeachersPage = lazy(() => import('@/pages/teachers/TeachersPage').then((m) => ({ default: m.TeachersPage })));
const PersonDetailsPage = lazy(() => import('@/pages/persons/PersonDetailsPage').then((m) => ({ default: m.PersonDetailsPage })));
const TerminalsPage = lazy(() => import('@/pages/terminals/TerminalsPage').then((m) => ({ default: m.TerminalsPage })));
const AttendanceOverviewPage = lazy(() =>
    import('@/pages/attendance/AttendanceOverviewPage').then((m) => ({ default: m.AttendanceOverviewPage })),
);
const AbsenceStreaksPage = lazy(() => import('@/pages/dashboard/AbsenceStreaksPage').then((m) => ({ default: m.AbsenceStreaksPage })));
const HomeroomPage = lazy(() => import('@/pages/homeroom/HomeroomPage').then((m) => ({ default: m.HomeroomPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SystemHealthPage = lazy(() =>
    import('@/pages/system-health/SystemHealthPage').then((m) => ({ default: m.SystemHealthPage })),
);
const SystemSettingsPage = lazy(() =>
    import('@/pages/system-settings/SystemSettingsPage').then((m) => ({ default: m.SystemSettingsPage })),
);
const LivePage = lazy(() => import('@/pages/live/LivePage').then((m) => ({ default: m.LivePage })));
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
const InspectorsManagePage = lazy(() => import('@/pages/inspector/InspectorsManagePage').then((m) => ({ default: m.InspectorsManagePage })));
const InspectorHomePage = lazy(() =>
    import('@/pages/inspector/InspectorHomePage')
        .then((m) => ({ default: m.InspectorHomePage }))
);
const InspectorAbsenteesPage = lazy(() =>
    import('@/pages/inspector/InspectorAbsenteesPage')
        .then((m) => ({ default: m.InspectorAbsenteesPage }))
);
const InspectorCasesPage = lazy(() =>
    import('@/pages/inspector/InspectorCasesPage')
        .then((m) => ({ default: m.InspectorCasesPage }))
);
const InspectorTalksPage = lazy(() =>
    import('@/pages/inspector/InspectorTalksPage')
        .then((m) => ({ default: m.InspectorTalksPage }))
);
const InspectorStudentsPage = lazy(() =>
    import('@/pages/inspector/InspectorStudentsPage')
        .then((m) => ({ default: m.InspectorStudentsPage }))
);
const TeacherJournalPage = lazy(() =>
    import('@/pages/teacher-dashboard/TeacherJournalPage')
        .then((m) => ({ default: m.TeacherJournalPage }))
);

const SyncHistoryPage = lazy(() =>
    import("@/pages/terminals/SyncHistoryPage").then(
        (module) => ({ default: module.SyncHistoryPage }),
    ),
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
                    { path: '/', element: <HomeRedirect /> },
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
                            { path: '/teacher/timetable', element: <TeacherTimetablePage /> },
                            { path: '/homeroom', element: <HomeroomPage /> },
                            { path: '/teacher/assessments', element: <TeacherAssessmentsPage /> },
                            { path: '/teacher/assessments/:id', element: <TeacherAssessmentPage /> },
                        ],
                    },
                    {
                        element: <RequireRole roles={['STUDENT']} />,
                        children: [
                            { path: '/student', element: <StudentHomePage /> },
                            { path: '/student/schedule', element: <StudentSchedulePage /> },
                            { path: '/student/attendance', element: <StudentOwnAttendancePage /> },
                            { path: '/student/assessments', element: <StudentAssessmentsPage /> },
                            { path: '/student/assessments/:id', element: <StudentTestPage /> },
                        ],
                    },
                    {
                        element: <RequireRole roles={['MAHALLA_INSPECTOR']} />,
                        children: [
                            { path: '/inspector', element: <InspectorHomePage /> },
                            { path: '/inspector/absentees', element: <InspectorAbsenteesPage /> },
                            { path: '/inspector/cases', element: <InspectorCasesPage /> },
                            {
                                path: '/inspector/students',
                                element: <InspectorStudentsPage />,
                            },
                        ],
                    },
                    {
                        // Suhbatlarni administratorlar ham ko‘radi: uchastkavoy qo‘riqchisidan tashqarida.
                        element: <RequireRole roles={TALK_VIEW_ROLES} />,
                        children: [
                            {
                                path: '/inspector/talks',
                                element: <InspectorTalksPage />,
                            },
                        ],
                    },
                    {
                        element: <RequireRole roles={ADMIN_ROLES} />,
                        children: [
                            { path: '/dashboard', element: <DashboardPage /> },
                            { path: '/dashboard/absence-streaks', element: <AbsenceStreaksPage /> },
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
                                element: <AttendanceOverviewPage />,
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
                            {
                                path: '/attendance/holidays',
                                element: <Navigate to="/attendance/calendar" replace />,
                            },
                            { path: '/classes', element: <ClassesPage /> },
                            { path: '/live', element: <LivePage /> },
                            {
                                path: '/journal',
                                element: <JournalPage />,
                            },
                            { path: '/users', element: <UsersPage /> },
                            {
                                element: <RequireRole roles={['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN']} />,
                                children: [{ path: '/inspectors', element: <InspectorsManagePage /> }],
                            },
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
                                    { path: '/system-settings', element: <SystemSettingsPage /> },
                                    { path: '/system/health', element: <SystemHealthPage /> },
                                    {
                                        path: '/textbooks',
                                        element: <TextbooksPage />,
                                    },
                                    {
                                        path: '/subjects',
                                        element: <SubjectsPage />,
                                    },

                                    {
                                        path: "/terminals/sync-history",
                                        element: <SyncHistoryPage />,
                                    },
                                    {
                                        path: "/terminals/person-sync-history",
                                        element: (
                                            <Navigate
                                                to="/terminals/sync-history?tab=persons"
                                                replace
                                            />
                                        ),
                                    },
                                    {
                                        path: "/terminals/person-sync-monitoring",
                                        element: (
                                            <Navigate
                                                to="/terminals/sync-history?tab=persons"
                                                replace
                                            />
                                        ),
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