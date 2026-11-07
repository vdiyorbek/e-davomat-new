import type { UserRole } from "@/types/auth";

export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGION_ADMIN",
  "DISTRICT_ADMIN",
  "SCHOOL_ADMIN",
];

export const INSPECTOR_ROLES: UserRole[] = ["MAHALLA_INSPECTOR"];

/** Suhbatlarni ko'ra oladigan rollar. */
export const TALK_VIEW_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  "MAHALLA_INSPECTOR",
];
