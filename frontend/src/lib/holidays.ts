import type { UserRole } from '@/types/auth';
import type { HolidayRule, HolidayScope } from '@/types/holiday';

/** Rol bo‘yicha qaysi hudud darajasida qoida yaratish mumkin (backend bilan bir xil). */
export function allowedScopes(role: UserRole | undefined): HolidayScope[] {
    switch (role) {
        case 'SUPER_ADMIN':
            return ['GLOBAL', 'REGION', 'DISTRICT', 'SCHOOL'];
        case 'REGION_ADMIN':
            return ['REGION', 'DISTRICT', 'SCHOOL'];
        case 'DISTRICT_ADMIN':
            return ['DISTRICT', 'SCHOOL'];
        case 'SCHOOL_ADMIN':
            return ['SCHOOL'];
        default:
            return [];
    }
}

export type HolidayTiming = 'past' | 'current' | 'upcoming';

/** Qoida bugunga nisbatan: o‘tgan, davom etmoqda yoki kelgusi. */
export function holidayTiming(rule: Pick<HolidayRule, 'startDate' | 'endDate'>, today: string): HolidayTiming {
    if (rule.endDate < today) return 'past';
    if (rule.startDate > today) return 'upcoming';
    return 'current';
}
