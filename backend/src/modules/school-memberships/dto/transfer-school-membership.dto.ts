import { IsDateString, IsInt, Matches, Max, Min } from 'class-validator';

export class TransferSchoolMembershipDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  schoolId!: number;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId!: number;

  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'Ko‘chirish sanasi YYYY-MM-DD formatida bo‘lsin',
  })
  @IsDateString(
    { strict: true },
    { message: 'Ko‘chirish sanasi haqiqiy sana bo‘lishi kerak' },
  )
  startDate!: string;
}
