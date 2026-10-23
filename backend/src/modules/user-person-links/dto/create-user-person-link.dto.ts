import { IsInt, Max, Min } from 'class-validator';

export class CreateUserPersonLinkDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  userId!: number;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  personId!: number;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  membershipId!: number;
}
