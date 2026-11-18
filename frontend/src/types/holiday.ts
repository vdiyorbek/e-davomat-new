export type HolidayAppliesTo = "STUDENT" | "TEACHER" | "BOTH";
export type HolidayScope = "GLOBAL" | "REGION" | "DISTRICT" | "SCHOOL";
export type HolidayDayType = "DAY_OFF" | "WORK_DAY";

interface NamedRef {
  id: number;
  name: string;
}

/** `GET /attendance-calendar/rules/list` javobidagi bitta qoida. */
export interface HolidayRule {
  id: number;
  startDate: string;
  endDate: string;
  dayType: HolidayDayType;
  appliesTo: HolidayAppliesTo;
  scopeType: HolidayScope;
  isMandatory: boolean;
  reason: string;
  region: NamedRef | null;
  district: NamedRef | null;
  school: NamedRef | null;
  schoolClass: NamedRef | null;
  createdBy: NamedRef | null;
  createdAt: string;
  canCancel: boolean;
}

export interface HolidayRulesPage {
  year: number;
  data: HolidayRule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
