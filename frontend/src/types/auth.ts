export type UserRole =
  | "USER"
  | "SUPER_ADMIN"
  | "REGION_ADMIN"
  | "DISTRICT_ADMIN"
  | "SCHOOL_ADMIN"
  | "TEACHER"
  | "STUDENT";

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: number;
    login: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    role: UserRole;
  };
}

export interface Profile {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  role: UserRole;
  regionId: number | null;
  districtId: number | null;
  schoolId: number | null;
  photoUrl: string | null;
}

export interface Session {
  token: string;
  profile: Profile;
  expiresAt: number;
}
