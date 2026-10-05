import type { Request } from 'express';
import type { Person } from 'src/modules/persons/person.entity';
import type { UserRole } from 'src/modules/users/enums/user-role.enum';

export interface AuthenticatedUser {
  id: number;
  login: string;
  personId: number;
  person: Person;
  role: UserRole;
  regionId: number | null;
  districtId: number | null;
  schoolId: number | null;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
