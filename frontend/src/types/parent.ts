export interface ParentChild {
    personId: number;
    firstName: string;
    lastName: string;
    schoolId: number;
    schoolName: string;
    className: string | null;
    hasPhoto: boolean;
}

export interface ParentMe {
    language: string;
    today: string;
    preferences: { arrival: boolean; leave: boolean; absent: boolean; excuse: boolean };
    children: ParentChild[];
}

export type DayStatus = 'inside' | 'left' | 'anomaly' | 'excused' | 'absent' | 'day_off' | 'unconfigured' | 'conflict' | 'no_data' | 'no_record';

export interface ParentDay {
    date: string;
    status: DayStatus;
    firstInTime: string | null;
    lastOutTime: string | null;
    excuse: { reason: string } | null;
}

export interface ParentMonth {
    month: string;
    child: ParentChild;
    stats: Record<DayStatus, number>;
    days: ParentDay[];
}

export interface ParentExcuse {
    id: number;
    status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED';
    reason: string;
    note: string | null;
    rejectionReason: string | null;
    from: string;
    to: string;
    createdAt: string;
}
