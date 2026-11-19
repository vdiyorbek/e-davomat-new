export type DashboardLevel = 'COUNTRY' | 'REGION' | 'DISTRICT' | 'SCHOOL';

export interface DashboardScope {
    level: DashboardLevel;
    region: { id: number; name: string; geoKey: string | null } | null;
    district: { id: number; name: string; geoKey: string | null } | null;
    school: { id: number; name: string } | null;
}

export interface DashboardKpi {
    members: number;
    expected: number;
    present: number;
    excused: number;
    absent: number;
    late: number;
    lateEvaluated: number;
    inside: number;
    dayOff: number;
    unknown: number;
    noData: number;
    assumedWorkDay: number;
    rate: number | null;
    lateRate: number | null;
}

export interface LateSettings {
    minutes: number;
    updatedAt: string | null;
    updatedBy: { login: string; name: string | null; role: string } | null;
}

export interface DashboardChild {
    id: number;
    name: string;
    geoKey: string | null;
    gradeLevel?: number | null;
    shiftCode?: number | null;
    dayState?: string;
    schools: number;
    schoolsWithoutData: number;
    students: { members: number; expected: number; present: number; excused: number; absent: number; late: number; rate: number | null };
    teachers: { expected: number; present: number; late: number; rate: number | null } | null;
    lateThreshold: LateSettings | null;
}

export interface DashboardOverview {
    scope: DashboardScope;
    date: string;
    previousDate: string | null;
    computedAt: string | null;
    students: DashboardKpi;
    teachers: DashboardKpi;
    previous: { students: DashboardKpi; teachers: DashboardKpi } | null;
    shifts: { code: number; expected: number; present: number; excused: number; late: number; rate: number | null }[];
    schools: { total: number; withoutData: number; calendarAssumed: number };
    terminals: { total: number; online: number; offline: number; unknown: number; disabled: number; push: number; polling: number };
    children: DashboardChild[];
    lateThreshold: LateSettings | null;
}

export interface TrendPoint {
    date: string;
    students: { expected: number; present: number; excused: number; late: number; rate: number | null } | null;
    teachers: { expected: number; present: number; excused: number; late: number; rate: number | null } | null;
}

export interface DashboardTrend {
    from: string;
    to: string;
    points: TrendPoint[];
}

export interface DashboardArrivals {
    date: string;
    bucketMinutes: number;
    buckets: { type: 'STUDENT' | 'TEACHER'; minute: number; count: number }[];
    shifts: { code: number; startTime: string; schools: number }[];
}

export interface AbsenceStreakRow {
    personId: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
    days: number;
    sinceDate: string;
    school: { id: number; name: string; district: string };
    className: string;
    mahalla: string | null;
}

export interface AbsenceStreaksPage {
    date: string;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    data: AbsenceStreakRow[];
}
