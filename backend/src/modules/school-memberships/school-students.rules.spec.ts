import { UserRole } from '../users/enums/user-role.enum';

import { birthDateValid, canCreateStudentIn } from './school-students.rules';

const school = { id: 10, districtId: 5, regionId: 2 };

const user = (
  role: UserRole,
  scope: { regionId?: number; districtId?: number; schoolId?: number } = {},
) => ({
  role,
  regionId: scope.regionId ?? null,
  districtId: scope.districtId ?? null,
  schoolId: scope.schoolId ?? null,
});

describe('school-students.rules', () => {
  it('SUPER_ADMIN hamma maktabga qo‘sha oladi', () => {
    expect(canCreateStudentIn(user(UserRole.SUPER_ADMIN), school)).toBe(true);
  });

  it('REGION_ADMIN faqat o‘z viloyatida', () => {
    expect(
      canCreateStudentIn(user(UserRole.REGION_ADMIN, { regionId: 2 }), school),
    ).toBe(true);
    expect(
      canCreateStudentIn(user(UserRole.REGION_ADMIN, { regionId: 3 }), school),
    ).toBe(false);
    expect(canCreateStudentIn(user(UserRole.REGION_ADMIN), school)).toBe(false);
  });

  it('DISTRICT_ADMIN faqat o‘z tumanida', () => {
    expect(
      canCreateStudentIn(
        user(UserRole.DISTRICT_ADMIN, { districtId: 5 }),
        school,
      ),
    ).toBe(true);
    expect(
      canCreateStudentIn(
        user(UserRole.DISTRICT_ADMIN, { districtId: 6 }),
        school,
      ),
    ).toBe(false);
  });

  it('SCHOOL_ADMIN faqat o‘z maktabida', () => {
    expect(
      canCreateStudentIn(user(UserRole.SCHOOL_ADMIN, { schoolId: 10 }), school),
    ).toBe(true);
    expect(
      canCreateStudentIn(user(UserRole.SCHOOL_ADMIN, { schoolId: 11 }), school),
    ).toBe(false);
    expect(canCreateStudentIn(user(UserRole.SCHOOL_ADMIN), school)).toBe(false);
  });

  it('boshqa rollar mumkin emas', () => {
    expect(
      canCreateStudentIn(user(UserRole.TEACHER, { schoolId: 10 }), school),
    ).toBe(false);
    expect(
      canCreateStudentIn(
        user(UserRole.MAHALLA_INSPECTOR, { districtId: 5 }),
        school,
      ),
    ).toBe(false);
  });

  it('birthDateValid', () => {
    expect(birthDateValid('2012-05-01', '2026-11-08')).toBe(true);
    expect(birthDateValid('2026-11-08', '2026-11-08')).toBe(true);
    expect(birthDateValid('2026-11-09', '2026-11-08')).toBe(false);
  });
});
