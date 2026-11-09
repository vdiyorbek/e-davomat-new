import type { Person } from "@/types/person";
import type { CreatedSchoolMembership } from "@/types/school-membership";
import { authorizedGet, authorizedPost } from "./auth-session";
export interface CreateSchoolStudentInput {
  /** Maktab admini uchun yuborilmaydi: server o‘z maktabini oladi. */
  schoolId?: number;
  classId?: number | null;
  pnfl: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  birthDate?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  mahallaId: number;
}

export interface CreatedSchoolStudent {
  person: Person;
  membership: CreatedSchoolMembership;
}

export function createSchoolStudent(
  input: CreateSchoolStudentInput,
): Promise<CreatedSchoolStudent> {
  return authorizedPost<CreatedSchoolStudent>("/school-students", input);
}

export interface ImportRowError {
  row: number;
  pnfl: string;
  message: string;
}

export interface StudentImportReport {
  applied: boolean;
  total: number;
  valid: number;
  created: number;
  failed: number;
  errors: ImportRowError[];
}

/** Excel shablonini yuklab oladi. */
export function downloadStudentImportTemplate(): Promise<Blob> {
  return authorizedGet<Blob>(
    "/school-students/import/template",
    undefined,
    "blob",
  );
}

/** apply=false: faqat tekshiradi; apply=true: haqiqiy import. */
export function importSchoolStudents(
  file: File,
  schoolId: number | undefined,
  apply: boolean,
): Promise<StudentImportReport> {
  const body = new FormData();
  body.append("file", file);

  if (schoolId !== undefined) {
    body.append("schoolId", String(schoolId));
  }

  body.append("apply", apply ? "true" : "false");

  return authorizedPost<StudentImportReport>(
    "/school-students/import",
    body,
    120_000,
  );
}
