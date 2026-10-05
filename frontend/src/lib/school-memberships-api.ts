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
