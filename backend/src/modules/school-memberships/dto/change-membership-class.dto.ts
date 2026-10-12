import { IsDateString, IsInt, Matches, Max, Min } from 'class-validator';

export class ChangeMembershipClassDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  classId!: number;

  @Matches(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/, {
    message: 'O‘tish sanasi YYYY-MM-DD formatida bo‘lishi kerak',
  })
  @IsDateString(
    { strict: true },
    { message: 'O‘tish sanasi haqiqiy sana bo‘lishi kerak' },
  )
  startDate!: string;
}
