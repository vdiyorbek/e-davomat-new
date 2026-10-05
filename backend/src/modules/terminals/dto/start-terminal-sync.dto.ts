import { IsDateString, Matches, MaxLength } from 'class-validator';

export class StartTerminalSyncDto {
  @MaxLength(40)
  @Matches(/^20\d{2}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message:
      'startTime vaqt zonasi bilan yuborilishi kerak, masalan: 2026-09-30T00:00:00+05:00',
  })
  @IsDateString({
    strict: true,
    strictSeparator: true,
  })
  startTime!: string;
}
