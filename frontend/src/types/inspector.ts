export type InspectorDayStatus = "PRESENT" | "EXCUSED" | "ABSENT" | "DAY_OFF";

export const INSPECTOR_STATUSES: InspectorDayStatus[] = [
  "PRESENT",
  "EXCUSED",
  "ABSENT",
  "DAY_OFF",
];

export interface InspectorStudent {
  personId: number;
  pnfl: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  mahalla: { id: number; name: string };
  school: { id: number; name: string };
  schoolClass: { id: number; name: string | null } | null;
  status: InspectorDayStatus;
}

export interface InspectorStudentsResponse {
  date: string;
  total: number;
  page: number;
  limit: number;
  counts: Record<InspectorDayStatus, number>;
  items: InspectorStudent[];
}

export interface InspectorMahalla {
  id: number;
  name: string;
}
export type TalkSpokeWith = "FATHER" | "MOTHER" | "GUARDIAN" | "STUDENT";
export type TalkResult = "SOLVED" | "RECHECK" | "REFERRED";

export const TALK_SPOKE_WITH: TalkSpokeWith[] = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "STUDENT",
];
export const TALK_RESULTS: TalkResult[] = ["SOLVED", "RECHECK", "REFERRED"];

export interface InspectorTalkItem {
  id: number;
  talkDate: string;
  spokeWith: TalkSpokeWith;
  reason: string;
  result: TalkResult;
  note: string | null;
  followUpDate: string | null;
  pdfOriginalName: string;
  pdfSize: number;
  createdAt: string;
  person: {
    id: number;
    pnfl: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  inspector: { id: number; firstName: string | null; lastName: string | null };
  canModify: boolean;
}

export interface InspectorTalksResponse {
  total: number;
  page: number;
  limit: number;
  items: InspectorTalkItem[];
}

// ───────────── O‘rganish ishlari (5+ kun kelmaganlar) ─────────────

export type CaseStatus = "OPEN" | "CLOSED";
export type CaseContact = "FATHER" | "MOTHER" | "GUARDIAN" | "STUDENT" | "NEIGHBOR" | "NOT_MET";
export type CaseReason = "ILLNESS" | "FAMILY" | "MIGRATED" | "WORKING" | "NO_INTEREST" | "NOT_FOUND" | "OTHER";
export type CaseOutcome = "RETURNED" | "EXCUSED" | "REFERRED" | "TRANSFERRED" | "STILL_ABSENT";

export const CASE_CONTACTS: CaseContact[] = ["FATHER", "MOTHER", "GUARDIAN", "STUDENT", "NEIGHBOR", "NOT_MET"];
export const CASE_REASONS: CaseReason[] = [
  "ILLNESS",
  "FAMILY",
  "MIGRATED",
  "WORKING",
  "NO_INTEREST",
  "NOT_FOUND",
  "OTHER",
];
export const CASE_OUTCOMES: CaseOutcome[] = ["RETURNED", "EXCUSED", "REFERRED", "TRANSFERRED", "STILL_ABSENT"];

export interface InspectorSummary {
  date: string;
  snapshotDate?: string | null;
  mahallaCount: number;
  students: number;
  today: Record<InspectorDayStatus, number>;
  absentees: number;
  newAbsentees: number;
  openCases: number;
  closedThisMonth: number;
  followUpsDue: number;
  minDays: number;
}

export interface InspectorAbsentee {
  personId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  days: number;
  sinceDate: string;
  school: { id: number; name: string };
  className: string | null;
  mahalla: { id: number; name: string };
  openCaseId: number | null;
  closedCases: number;
}

export interface InspectorAbsenteesResponse {
  date: string | null;
  total: number;
  page: number;
  limit: number;
  minDays: number;
  items: InspectorAbsentee[];
}

export interface InspectorCaseListItem {
  id: number;
  personId: number;
  status: CaseStatus;
  outcome: CaseOutcome | null;
  reason: CaseReason | null;
  absentDays: number;
  absentSince: string;
  visitDate: string | null;
  followUpDate: string | null;
  createdAt: string;
  closedAt: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  school: string;
  className: string | null;
  mahalla: string | null;
}

export interface InspectorCasesResponse {
  total: number;
  page: number;
  limit: number;
  items: InspectorCaseListItem[];
}

export interface InspectorCaseDetail {
  id: number;
  personId: number;
  status: CaseStatus;
  absentSince: string;
  absentDays: number;
  visitDate: string | null;
  spokeWith: CaseContact | null;
  reason: CaseReason | null;
  findings: string | null;
  actionsTaken: string | null;
  outcome: CaseOutcome | null;
  followUpDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    mahalla: string | null;
    school: string;
    className: string | null;
  };
  history: { id: number; outcome: CaseOutcome | null; absentSince: string; closedAt: string | null }[];
}
