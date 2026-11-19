import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

interface ScopedSchool {
  id: number;
  districtId: number;
  district: { regionId: number };
}

/** Admin maktabni boshqara oladimi: viloyat, tuman yoki o‘z maktabi doirasida. */
export function assertSchoolAccess(
  user: AuthenticatedUser,
  school: ScopedSchool,
): void {
  switch (user.role) {
    case UserRole.SUPER_ADMIN:
      return;

    case UserRole.REGION_ADMIN:
      if (user.regionId && school.district.regionId === user.regionId) return;
      throw new ForbiddenException('Ushbu viloyat maktabiga ruxsat yo‘q');

    case UserRole.DISTRICT_ADMIN:
      if (user.districtId && school.districtId === user.districtId) return;
      throw new ForbiddenException('Ushbu tuman maktabiga ruxsat yo‘q');

    case UserRole.SCHOOL_ADMIN:
      if (user.schoolId && school.id === user.schoolId) return;
      throw new ForbiddenException(
        'Faqat o‘z maktabingizni boshqarishingiz mumkin',
      );

    default:
      throw new ForbiddenException('Smena boshqarish huquqi yo‘q');
  }
}

export function todayInTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
