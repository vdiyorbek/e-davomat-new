import type { ExcuseReason } from '@/types/attendance-excuse';

export type PersonDayStatus =
    | 'inside'
    | 'left'
    | 'anomaly'
    | 'excused'
    | 'absent'
    | 'day_off'
    | 'unconfigured'
    | 'conflict'
    | 'no_data'
    | 'no_record';

export interface PersonAttendanceDay {
    date: string;
    dailyId: string | null;
    status: PersonDayStatus;
    firstInTime: string | null;
    lastOutTime: string | null;
    firstInUrl: string | null;
    lastOutUrl: string | null;
    schoolName: string | null;
    className: string | null;
    excuse: { id: number; reason: ExcuseReason; reasonNote: string | null } | null;
}

export interface PersonAttendanceHistory {
    membershipType: 'STUDENT' | 'TEACHER';
    from: string;
    to: string;
    person: {
        id: number;
        pnfl: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
        gender: 'MALE' | 'FEMALE' | null;
        nationality: string | null;
        birthDate: string | null;
        phoneNumber: string | null;
        address: string | null;
        photoUrl: string | null;
    };
    membership: {
        id: number;
        startDate: string;
        endDate: string | null;
        active: boolean;
        position: string | null;
        school: { id: number; name: string };
        district: { id: number; name: string };
        region: { id: number; name: string };
        schoolClass: { id: number; name: string; gradeLevel: number | null } | null;
    };
    stats: Record<PersonDayStatus, number>;
    days: PersonAttendanceDay[];
}
