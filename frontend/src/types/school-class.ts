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
  stats: { students: number };
}

export interface SchoolClassesPage {
  data: SchoolClassRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  missingGrade: number;
}
