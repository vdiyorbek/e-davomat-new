import { IsInt, Max, Min } from 'class-validator';

export class DownloadEventPhotosDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  terminalId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  limit: number = 5;
}
