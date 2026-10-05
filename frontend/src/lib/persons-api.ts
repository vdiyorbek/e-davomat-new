import { ApiError } from "@/lib/api";
import {
  authorizedGet,
  authorizedPost,
  authorizedPatch,
} from "@/lib/auth-session";

import type {
  Person,
  PersonsPage,
  CreatePersonInput,
  UpdatePersonInput,
} from "@/types/person";

export async function findPersonByPnfl(
  pnfl: string,
  signal?: AbortSignal,
): Promise<Person | null> {
  const normalizedPnfl = pnfl.trim();

  if (!/^[0-9]{14}$/.test(normalizedPnfl)) {
    throw new ApiError("PNFL aynan 14 ta raqamdan iborat bo‘lishi kerak.", 400);
  }

  const query = new URLSearchParams({
    pnfl: normalizedPnfl,
    page: "1",
    limit: "1",
  });

  const result = await authorizedGet<PersonsPage>(
    `/persons?${query.toString()}`,
    signal,
  );

  return result.data[0] ?? null;
}

export function createPerson(input: CreatePersonInput): Promise<Person> {
  return authorizedPost<Person>("/persons", input);
}

export function updatePerson(
  id: number,
  input: UpdatePersonInput,
): Promise<Person> {
  return authorizedPatch<Person>(`/persons/${id}`, input);
}
