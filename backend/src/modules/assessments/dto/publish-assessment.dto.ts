import { IsISO8601 } from 'class-validator';

export class PublishAssessmentDto {
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;
}
