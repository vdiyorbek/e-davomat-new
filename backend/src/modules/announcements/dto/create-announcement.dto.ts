import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const ANNOUNCEMENT_KINDS = ['INFO', 'TASK', 'URGENT'] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export const ANNOUNCEMENT_SCOPES = [
  'ALL',
  'REGION',
  'DISTRICT',
  'SCHOOLS',
] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

/** Xabar yuborish mumkin bo‘lgan rollar. */
export const RECIPIENT_ROLES = [
  'REGION_ADMIN',
  'DISTRICT_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'MAHALLA_INSPECTOR',
] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export class CreateAnnouncementDto {
  @IsIn(ANNOUNCEMENT_KINDS)
  kind!: AnnouncementKind;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  /** Faqat tizim ichidagi yo‘l: `/persons/123?edit=1`. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  @Matches(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/, {
    message: 'Havola tizim ichidagi yo‘l bo‘lishi kerak (masalan, /persons/12)',
  })
  linkPath?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsIn(ANNOUNCEMENT_SCOPES)
  scope!: AnnouncementScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  schoolIds?: number[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(RECIPIENT_ROLES, { each: true })
  roles!: RecipientRole[];
}

export class ListAnnouncementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class DataGapsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;
}

export class NotifyGapsDto {
  @IsIn(['PHOTO', 'GUARDIAN'])
  gap!: 'PHOTO' | 'GUARDIAN';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  schoolIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;
}
