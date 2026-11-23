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
  /** Parolni almashtirish talab qilinadimi. */
  mustChangePassword?: boolean;
  /** Joriy kirish sessiyasi (parol almashtirilganda boshqalari tugatiladi). */
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
