import type { Request } from 'express';
import type { UserRole } from 'src/modules/users/enums/user-role.enum';

export interface AuthenticatedUser {
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

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
