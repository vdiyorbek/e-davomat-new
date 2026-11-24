import { UserRole } from '../users/enums/user-role.enum';

/** Ichki chaqiruv uchun: ota-onaning farzandga egaligi allaqachon tekshirilgan. */
export const INTERNAL_USER = {
  id: 0,
  login: 'parent-app',
  firstName: null,
  lastName: null,
  middleName: null,
  role: UserRole.SUPER_ADMIN,
  regionId: null,
  districtId: null,
  schoolId: null,
  photoUrl: null,
};
