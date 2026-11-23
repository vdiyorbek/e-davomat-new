import type { DataSource } from 'typeorm';

export interface GuardianContact {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  phoneNumber: string | null;
}

export interface GuardianContacts {
  father: GuardianContact | null;
  mother: GuardianContact | null;
}

export const NO_GUARDIANS: GuardianContacts = { father: null, mother: null };

/**
 * Ro‘yxatdagi o‘quvchilarning ota-ona aloqa ma’lumoti (bitta so‘rov bilan).
 * Uchastkavoyga faqat o‘z mahallasidagi o‘quvchilar ro‘yxati bo‘yicha beriladi:
 * chaqiruvchi personId'larni allaqachon mahalla bo‘yicha filtrlab bo‘lgan bo‘ladi.
 */
export async function loadGuardianContacts(
  dataSource: DataSource,
  personIds: number[],
): Promise<Map<number, GuardianContacts>> {
  const result = new Map<number, GuardianContacts>();
  if (personIds.length === 0) return result;

  const rows = await dataSource.query<
    {
      personId: number;
      relation: 'FATHER' | 'MOTHER';
      lastName: string | null;
      firstName: string | null;
      middleName: string | null;
      phoneNumber: string | null;
    }[]
  >(
    `SELECT personId, relation, lastName, firstName, middleName, phoneNumber
       FROM person_guardians
      WHERE personId IN (${personIds.map(() => '?').join(',')})`,
    personIds,
  );

  for (const row of rows) {
    const entry = result.get(Number(row.personId)) ?? {
      father: null,
      mother: null,
    };
    const contact: GuardianContact = {
      lastName: row.lastName,
      firstName: row.firstName,
      middleName: row.middleName,
      phoneNumber: row.phoneNumber,
    };
    if (row.relation === 'FATHER') entry.father = contact;
    else entry.mother = contact;
    result.set(Number(row.personId), entry);
  }
  return result;
}
