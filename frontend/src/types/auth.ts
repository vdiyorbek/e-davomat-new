export type UserRole =
  | "USER"
  | "SUPER_ADMIN"
  | "REGION_ADMIN"
  | "DISTRICT_ADMIN"
  | "SCHOOL_ADMIN";

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: number;
    login: string;
    personId: number;
    firstName: string;
    lastName: string;
  };
}

export interface Profile {
  id: number;
  login: string;
  role: UserRole;
  personId: number;
  person: {
    id: number;
    pnfl: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    gender: "MALE" | "FEMALE" | null;
    nationality: string | null;
    birthDate: string | null;
    address: string | null;
    phoneNumber: string | null;
    photoUrl: string | null;
  };
}

export interface Session {
  token: string;
  profile: Profile;
  expiresAt: number;
}
