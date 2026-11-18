import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';

import { MembershipType } from '../../school-memberships/school-membership.entity';

/** Bitta shaxsning davr bo‘yicha davomati (batafsil oyna uchun). */
export class GetPersonAttendanceQueryDto {
  @Matches(/^\d{14}$/, { message: 'PNFL 14 ta raqamdan iborat bo‘lishi kerak' })
  pnfl!: string;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType: MembershipType = MembershipType.STUDENT;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;
}
