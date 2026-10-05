import type { Profile } from "@/types/auth";

export type Person = Profile["person"];

export interface PersonsPage {
  data: Person[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreatePersonInput {
  pnfl: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  nationality?: string | null;
  birthDate?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
}

export type UpdatePersonInput = Partial<Omit<CreatePersonInput, "pnfl">>;
