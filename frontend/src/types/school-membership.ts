import type { Profile } from "./auth";
import type { School } from "./school";

export interface SchoolMembership {
  id: number;
  personId: number;
  schoolId: number;
  type: "STUDENT" | "TEACHER";
  startDate: string;
  endDate: string | null;
  person: Pick<
    Profile["person"],
    "id" | "pnfl" | "firstName" | "lastName" | "middleName"
  > | null;
  school: School;
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
}

export type CreatedSchoolMembership = Omit<
  SchoolMembership,
  "person" | "school"
>;
