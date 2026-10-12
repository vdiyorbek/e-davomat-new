import type { Person } from "./person";
import type { School } from "./school";

export interface SchoolMembership {
  id: number;
  personId: number;
  schoolId: number;
  type: "STUDENT" | "TEACHER";
  startDate: string;
  endDate: string | null;
  person: Pick<
  Person,
  "id" | "pnfl" | "firstName" | "lastName" | "middleName"
> | null;
  school: School;
  classId?: number | null;
  schoolClass?: {
    id: number;
    schoolId: number;
    academicYear: string;
    name: string;
  } | null;
}

export interface SchoolMembershipsPage {
  data: SchoolMembership[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSchoolMembershipInput {
  personId: number;
  schoolId: number;
  type: SchoolMembership["type"];
  startDate: string;
  endDate?: string | null;
  classId?: number | null;
}

export type CreatedSchoolMembership = Omit<
  SchoolMembership,
  "person" | "school"
>;
