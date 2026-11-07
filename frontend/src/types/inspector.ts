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
