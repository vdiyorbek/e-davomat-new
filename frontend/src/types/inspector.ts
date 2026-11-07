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
