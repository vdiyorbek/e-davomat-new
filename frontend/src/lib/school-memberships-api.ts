import { authorizedPost, authorizedPatch } from "./auth-session";

import type {
  CreateSchoolMembershipInput,
  CreatedSchoolMembership,
} from "@/types/school-membership";

export function createSchoolMembership(
  input: CreateSchoolMembershipInput,
): Promise<CreatedSchoolMembership> {
  return authorizedPost<CreatedSchoolMembership>("/school-memberships", input);
}

export function endSchoolMembership(
  membershipId: number,
  endDate: string,
): Promise<CreatedSchoolMembership> {
  return authorizedPatch<CreatedSchoolMembership>(
    `/school-memberships/${membershipId}/end`,
    { endDate },
  );
}

export function changeMembershipClass(
  membershipId: number,
  input: {
    classId: number;
    startDate: string;
  },
): Promise<CreatedSchoolMembership> {
  return authorizedPost<CreatedSchoolMembership>(
    `/school-memberships/${membershipId}/change-class`,
    input,
  );
}

export function transferSchoolMembership(
  membershipId: number,
  input: {
    schoolId: number;
    classId: number;
    startDate: string;
  },
): Promise<CreatedSchoolMembership> {
  return authorizedPost<CreatedSchoolMembership>(
    `/school-memberships/${membershipId}/transfer-school`,
    input,
  );
}
