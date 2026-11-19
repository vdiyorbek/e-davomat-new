import type { School } from "./school";

export interface SchoolClass {
  id: number;
  schoolId: number;
  academicYear: string;
  name: string;
  gradeLevel: number | null;
}

export interface SchoolClassRow extends SchoolClass {
  school: School;
  shift: CurrentClassShift | null;
  stats: { students: number };
}

export interface SchoolClassesPage {
  data: SchoolClassRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  missingGrade: number;
  missingShift: number;
}

export type ShiftCode = 1 | 2;

export interface CurrentClassShift {
  code: ShiftCode;
  name: string;
  startTime: string;
  endTime: string;
  startDate: string;
}

export interface SchoolShift {
  code: ShiftCode;
  name: string;
  startTime: string;
  endTime: string;
  configured: boolean;
}
