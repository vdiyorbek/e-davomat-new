export type ExcuseReason = "ILLNESS" | "OLYMPIAD" | "FAMILY" | "OTHER";

export type ExcuseStatus = "ACTIVE" | "CANCELLED";

export interface AttendanceExcuse {
  id: number;
  personId: number;
  schoolId: number;
  membershipType: "STUDENT" | "TEACHER";
  /** Ariza sanasidagi sinf (faqat o‘quvchilar uchun). */
  className: string | null;

  person: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
    pnfl: string | null;
  } | null;

  school: {
    id: number;
    name: string;
  };

  reason: ExcuseReason;
  reasonNote: string | null;
  startDate: string;
  endDate: string;
  status: ExcuseStatus;

  pdfOriginalName: string;
  uploadedByUserId: number;
  uploadedBy: { id: number; name: string } | null;
  cancelledByUserId: number | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface AttendanceExcusesPageResponse {
  data: AttendanceExcuse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const EXCUSE_REASONS: ExcuseReason[] = ["ILLNESS", "OLYMPIAD", "FAMILY", "OTHER"];
