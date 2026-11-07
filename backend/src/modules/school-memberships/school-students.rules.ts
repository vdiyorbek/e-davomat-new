import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

export interface SchoolScope {
  id: number;
  districtId: number;
  regionId: number;
}

/** Foydalanuvchi shu maktabda o'quvchi qo'sha oladimi? */
export function canCreateStudentIn(
  user: Pick<
    AuthenticatedUser,
    'role' | 'regionId' | 'districtId' | 'schoolId'
  >,
  school: SchoolScope,
): boolean {
  switch (user.role) {
    case UserRole.SUPER_ADMIN:
      return true;
    case UserRole.REGION_ADMIN:
      return user.regionId !== null && user.regionId === school.regionId;
    case UserRole.DISTRICT_ADMIN:
      return user.districtId !== null && user.districtId === school.districtId;
    case UserRole.SCHOOL_ADMIN:
      return user.schoolId !== null && user.schoolId === school.id;
    default:
      return false;
  }
}

/** Tug'ilgan sana kelajakda bo'lmasligi kerak (YYYY-MM-DD, satr taqqoslash). */
export function birthDateValid(birthDate: string, today: string): boolean {
  return birthDate <= today;
}
