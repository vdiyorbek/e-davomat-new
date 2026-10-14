export type AttendancePhotoStatus =
  | "PENDING"
  | "DOWNLOADED"
  | "MISSING"
  | "FAILED";

export type AttendanceStatus =
  | "inside"
  | "left"
  | "excused"
  | "absent"
  | "anomaly";

export interface DailyAttendance {
  id: string;
  date: string;
  pnfl: string;
  attendanceStatus: AttendanceStatus;

  person: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
  } | null;

  firstInTime: string | null;
  firstInEventId: string | null;
  firstInUrl: string | null;
  firstInPhotoStatus: AttendancePhotoStatus | null;

  lastOutTime: string | null;
  lastOutEventId: string | null;
  lastOutUrl: string | null;
  lastOutPhotoStatus: AttendancePhotoStatus | null;

  schoolId: number;
  districtId: number;
  regionId: number;

  school: { id: number; name: string };
  district: { id: number; name: string };
  region: { id: number; name: string };

  createdAt: string;
  updatedAt: string;
}

export interface DailyAttendancePageResponse {
  data: DailyAttendance[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
