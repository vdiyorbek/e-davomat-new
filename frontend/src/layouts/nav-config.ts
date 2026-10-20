import {
    BookOpen,
    BookOpenCheck,
    Building2,
    CalendarDays,
    ClipboardCheck,
    FileCheck2,
    GraduationCap,
    LibraryBig,
    Presentation,
    ScanFace,
    School,
    UserCog,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ADMIN_ROLES } from '@/lib/roles';
import type { UserRole } from '@/types/auth';

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

const EXCUSE_ROLES: UserRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN'];

/** Menyuning yagona manbasi: yon panel, pastki panel va sarlavhalar shundan olinadi. */
export const NAV_GROUPS: NavGroup[] = [
    {
        key: 'personal',
        items: [
            { to: '/me', key: 'profile', icon: UserRound, mobilePriority: 9 },
        ],
    },
    {
        key: 'attendance',
        items: [
            { to: '/attendance/students', key: 'studentAttendance', icon: ClipboardCheck, roles: ADMIN_ROLES, mobilePriority: 1 },
            { to: '/attendance/teachers', key: 'teacherAttendance', icon: BookOpen, roles: ADMIN_ROLES, mobilePriority: 2 },
            { to: '/attendance-excuses', key: 'excuses', icon: FileCheck2, roles: EXCUSE_ROLES },
            { to: '/attendance/calendar', key: 'calendar', icon: CalendarDays, roles: ADMIN_ROLES },
        ],
    },
    {
        key: 'education',
        items: [
            { to: '/schools', key: 'schools', icon: Building2, roles: ADMIN_ROLES, mobilePriority: 3 },
            { to: '/classes', key: 'classes', icon: School, roles: ADMIN_ROLES },
            { to: '/students', key: 'students', icon: GraduationCap, roles: ADMIN_ROLES },
            { to: '/teachers', key: 'teachers', icon: Presentation, roles: ADMIN_ROLES },
            { to: '/teacher-assignments', key: 'assignments', icon: BookOpenCheck, roles: ADMIN_ROLES },
            { to: '/textbooks', key: 'textbooks', icon: LibraryBig, roles: ['SUPER_ADMIN'] },
        ],
    },
    {
        key: 'system',
        items: [
            { to: '/terminals', key: 'terminals', icon: ScanFace, roles: ADMIN_ROLES },
            { to: '/users', key: 'users', icon: UserCog, roles: ADMIN_ROLES },
        ],
    },
];

export function navGroupsFor(role: UserRole): NavGroup[] {
    return NAV_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
        }))
        .filter((group) => group.items.length > 0);
}

/** Joriy manzilga eng mos menyu bandini topadi (eng uzun prefiks). */
export function findNavItem(pathname: string): NavItem | undefined {
    const path = pathname.replace(/\/+$/, '') || '/';
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
