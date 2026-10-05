import {
  IsDateString,
  IsInt,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SyncAttendanceEventsDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  terminalId!: number;

  @MaxLength(40)
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'startTime vaqt zonasi bilan yuborilishi kerak',
  })
  @IsDateString({ strict: true, strictSeparator: true })
  startTime!: string;

  @MaxLength(40)
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endTime vaqt zonasi bilan yuborilishi kerak',
  })
  @IsDateString({ strict: true, strictSeparator: true })
  endTime!: string;
}
