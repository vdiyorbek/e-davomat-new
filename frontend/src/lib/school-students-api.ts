import { authorizedPost } from "./auth-session";

import type { Person } from "@/types/person";
import type { CreatedSchoolMembership } from "@/types/school-membership";

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
