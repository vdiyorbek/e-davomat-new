export type ExcuseReason = "ILLNESS" | "OLYMPIAD" | "FAMILY" | "OTHER";

export type ExcuseStatus = "ACTIVE" | "CANCELLED";

export interface AttendanceExcuse {
  id: number;
  personId: number;
  schoolId: number;

  person: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
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

export const EXCUSE_REASON_LABELS: Record<ExcuseReason, string> = {
  ILLNESS: "Kasallik",
  OLYMPIAD: "Olimpiada",
  FAMILY: "Oilaviy sabab",
  OTHER: "Boshqa sabab",
};
