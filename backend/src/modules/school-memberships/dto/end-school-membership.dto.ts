import { IsDateString, Matches } from 'class-validator';

export class EndSchoolMembershipDto {
  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'endDate YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsDateString(
    { strict: true },
    { message: 'endDate haqiqiy sana bo‘lishi kerak' },
  )
  endDate!: string;
}
