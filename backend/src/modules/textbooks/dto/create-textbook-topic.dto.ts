import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateTextbookTopicDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  chapterTitle?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  pageStart?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  pageEnd?: number | null;
}
