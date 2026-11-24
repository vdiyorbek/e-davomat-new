import {
  BookOpen,
  BookMarked,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LibraryBig,
  NotebookPen,
  Presentation,
  ScanFace,
  School,
  UserCog,
  UserRound,
  LayoutDashboard,
  MapPinned,
  History,
  UsersRound,
  MessagesSquare,
  ClipboardList,
  CalendarRange,
  Home,
  Radio,
  SlidersHorizontal,
  HeartPulse,
  Megaphone,
  Send,
  UserX,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ADMIN_ROLES, TALK_VIEW_ROLES } from "@/lib/roles";
import type { UserRole } from "@/types/auth";

export interface NavItem {
  to: string;
  /** i18n kaliti: `nav.items.<key>` (to‘liq) va `nav.short.<key>` (pastki panel uchun qisqa). */
  key: string;
  icon: LucideIcon;
  roles?: UserRole[];
  /** Telefondagi pastki panelda ko‘rsatish tartibi (kichik — oldinroq). */
  mobilePriority?: number;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

const EXCUSE_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"];

/** Menyuning yagona manbasi: yon panel, pastki panel va sarlavhalar shundan olinadi. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "personal",
    items: [
      {
        to: "/dashboard",
        key: "dashboard",
        icon: LayoutDashboard,
        roles: ADMIN_ROLES,
        mobilePriority: 0,
      },
      { to: "/me", key: "profile", icon: UserRound, mobilePriority: 9 },
      {
        to: "/teacher/dashboard",
        key: "teacherDashboard",
        icon: LayoutDashboard,
        roles: ["TEACHER"],
        mobilePriority: 1,
      },
      {
        to: "/homeroom",
        key: "homeroom",
        icon: UserRoundCheck,
        roles: ["TEACHER"],
        mobilePriority: 4,
      },
      {
        to: "/teacher/timetable",
        key: "teacherTimetable",
        icon: CalendarRange,
        roles: ["TEACHER"],
        mobilePriority: 2,
      },
      {
        to: "/teacher/assessments",
        key: "teacherAssessments",
        icon: ClipboardList,
        roles: ["TEACHER"],
        mobilePriority: 3,
      },
      {
        to: "/student",
        key: "studentHome",
        icon: Home,
        roles: ["STUDENT"],
        mobilePriority: 1,
      },
      {
        to: "/student/schedule",
        key: "studentSchedule",
        icon: CalendarRange,
        roles: ["STUDENT"],
        mobilePriority: 2,
      },
      {
        to: "/student/assessments",
        key: "studentTests",
        icon: ClipboardList,
        roles: ["STUDENT"],
        mobilePriority: 3,
      },
      {
        to: "/student/attendance",
        key: "myAttendance",
        icon: ClipboardCheck,
        roles: ["STUDENT"],
        mobilePriority: 4,
      },
    ],
  },
  {
    key: "inspector",
    items: [
      {
        to: "/inspector",
        key: "inspectorHome",
        icon: Home,
        roles: ["MAHALLA_INSPECTOR"],
        mobilePriority: 1,
      },
      {
        to: "/inspector/absentees",
        key: "inspectorAbsentees",
        icon: UserX,
        roles: ["MAHALLA_INSPECTOR"],
        mobilePriority: 2,
      },
      {
        to: "/inspector/cases",
        key: "inspectorCases",
        icon: FileCheck2,
        roles: ["MAHALLA_INSPECTOR"],
        mobilePriority: 3,
      },
      {
        to: "/inspector/students",
        key: "inspectorStudents",
        icon: UsersRound,
        roles: ["MAHALLA_INSPECTOR"],
        mobilePriority: 4,
      },
      {
        to: "/inspector/talks",
        key: "inspectorTalks",
        icon: MessagesSquare,
        roles: TALK_VIEW_ROLES,
      },
    ],
  },
  {
    key: "attendance",
    items: [
      {
        to: "/attendance",
        key: "attendanceOverview",
        icon: MapPinned,
        roles: ADMIN_ROLES,
      },
      {
        to: "/live",
        key: "live",
        icon: Radio,
        roles: ADMIN_ROLES,
      },
      {
        to: "/attendance/students",
        key: "studentAttendance",
        icon: ClipboardCheck,
        roles: ADMIN_ROLES,
        mobilePriority: 1,
      },
      {
        to: "/attendance/teachers",
        key: "teacherAttendance",
        icon: BookOpen,
        roles: ADMIN_ROLES,
        mobilePriority: 2,
      },
      {
        to: "/attendance-excuses",
        key: "excuses",
        icon: FileCheck2,
        roles: EXCUSE_ROLES,
      },
      {
        to: "/attendance/calendar",
        key: "calendar",
        icon: CalendarDays,
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    key: "education",
    items: [
      {
        to: "/schools",
        key: "schools",
        icon: Building2,
        roles: ADMIN_ROLES,
        mobilePriority: 3,
      },
      { to: "/classes", key: "classes", icon: School, roles: ADMIN_ROLES },
      {
        to: "/students",
        key: "students",
        icon: GraduationCap,
        roles: ADMIN_ROLES,
      },
      {
        to: "/teachers",
        key: "teachers",
        icon: Presentation,
        roles: ADMIN_ROLES,
      },
      {
        to: "/teacher-assignments",
        key: "assignments",
        icon: BookOpenCheck,
        roles: ADMIN_ROLES,
      },
      {
        to: "/lesson-schedules",
        key: "lessonSchedules",
        icon: CalendarClock,
        roles: ADMIN_ROLES,
      },
      { to: "/journal", key: "journal", icon: NotebookPen, roles: ADMIN_ROLES },
      {
        to: "/subjects",
        key: "subjects",
        icon: BookMarked,
        roles: ["SUPER_ADMIN"],
      },
      {
        to: "/textbooks",
        key: "textbooks",
        icon: LibraryBig,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
  {
    key: "system",
    items: [
      {
        to: "/terminals",
        key: "terminals",
        icon: ScanFace,
        roles: ADMIN_ROLES,
      },

      {
        to: "/terminals/sync-history",
        key: "syncHistory",
        icon: History,
        roles: ["SUPER_ADMIN"],
      },
      {
        to: "/parent-notify",
        key: "parentNotify",
        icon: Send,
        roles: ["SUPER_ADMIN"],
      },
      {
        to: "/announcements",
        key: "announcements",
        icon: Megaphone,
        roles: ["SUPER_ADMIN", "REGION_ADMIN"],
      },
      {
        to: "/system/health",
        key: "systemHealth",
        icon: HeartPulse,
        roles: ["SUPER_ADMIN"],
      },
      {
        to: "/system-settings",
        key: "systemSettings",
        icon: SlidersHorizontal,
        roles: ["SUPER_ADMIN"],
      },
      {
        to: "/users",
        key: "users",
        icon: UserCog,
        roles: ADMIN_ROLES,
      },
      {
        to: "/inspectors",
        key: "inspectorsManage",
        icon: UserPlus,
        roles: ["SUPER_ADMIN", "REGION_ADMIN", "DISTRICT_ADMIN"],
      },
    ],
  },
];

export function navGroupsFor(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Joriy manzilga eng mos menyu bandini topadi (eng uzun prefiks). */
export function findNavItem(pathname: string): NavItem | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: NavItem | undefined;

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (path === item.to || path.startsWith(`${item.to}/`)) {
        if (!best || item.to.length > best.to.length) best = item;
      }
    }
  }

  return best;
}

/** Telefondagi pastki panel uchun 4 tagacha asosiy band. */
export function mobileNavItems(role: UserRole): NavItem[] {
  return navGroupsFor(role)
    .flatMap((group) => group.items)
    .filter((item) => item.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? 0) - (b.mobilePriority ?? 0))
    .slice(0, 4);
}
