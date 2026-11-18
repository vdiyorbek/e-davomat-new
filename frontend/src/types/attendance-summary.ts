export type SummaryLevel = 'REGION' | 'DISTRICT' | 'SCHOOL' | 'CLASS';

export type SummaryBand = 'LOW' | 'MEDIUM' | 'HIGH';

export type SummaryMembershipType = 'STUDENT' | 'TEACHER';

export interface SummaryCounters {
    /** Takrorlanmas shaxslar soni. */
    persons: number;
    /** Davrdagi jami kishi-kunlar. */
    personDays: number;
    present: number;
    absent: number;
    excused: number;
    dayOff: number;
    /** Kalendar sozlanmagan kunlardagi kelmaganlar (foizga kirmaydi). */
    unknown: number;
    /** Ish kunlaridagi kishi-kunlar — foiz maxraji. */
    expected: number;
    rate: number | null;
    band: SummaryBand | null;
}

export interface SummaryItem extends SummaryCounters {
    /** Viloyat / tuman / maktab / sinf ID’si. Sinf uchun 0 — sinf biriktirilmagan. */
    id: number;
    name: string | null;
    subtitle: string | null;
    gradeLevel: number | null;
}

export interface AttendanceSummary {
    level: SummaryLevel;
    membershipType: SummaryMembershipType;
    from: string;
    to: string;
    days: number;
    generatedAt: string;
    bands: { lowBelow: number; highAbove: number };
    totals: SummaryCounters;
    items: SummaryItem[];
}
