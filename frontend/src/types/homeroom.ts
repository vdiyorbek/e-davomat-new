import type { DailyAttendance } from './daily-attendance';

export interface HomeroomClass {
    id: number;
    schoolId: number;
    name: string;
    academicYear: string;
    gradeLevel: number | null;
    schoolName: string;
    students: number;
}

export type DayCell = 'present' | 'absent' | 'excused' | 'dayoff' | 'nodata' | 'future';

export interface HomeroomAttendance {
    class: { id: number; name: string; schoolName: string; schoolId: number };
    data: DailyAttendance[];
    total: number;
}

export interface HomeroomWeek {
    from: string;
    to: string;
    days: { date: string; state: string; hasData: boolean }[];
    students: {
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        cells: DayCell[];
        present: number;
        absent: number;
        excused: number;
    }[];
}

export interface HomeroomGuardian {
    relation: 'FATHER' | 'MOTHER';
    name: string;
    phoneNumber: string | null;
}

export interface HomeroomAbsentees {
    minDays: number;
    date: string;
    data: {
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        days: number;
        sinceDate: string | null;
        guardians: HomeroomGuardian[];
    }[];
}

export interface HomeroomStudentCard {
    person: { personId: number; firstName: string; lastName: string; middleName: string | null };
    guardians: {
        relation: 'FATHER' | 'MOTHER';
        lastName: string | null;
        firstName: string | null;
        middleName: string | null;
        phoneNumber: string | null;
    }[];
    last30: { present: number; absent: number; excused: number; rate: number | null };
    days: { date: string; cell: DayCell }[];
}

export interface HomeroomExcuse {
    id: number;
    personId: number;
    person: { id: number; firstName: string; lastName: string; middleName: string | null };
    reason: 'ILLNESS' | 'OLYMPIAD' | 'FAMILY' | 'OTHER';
    reasonNote: string | null;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'REJECTED';
    rejectionReason: string | null;
    cancellationReason: string | null;
    createdAt: string;
}
