import { IsObject } from 'class-validator';

export class SaveAnswersDto {
  /** { "<savol ID>": 0..3 } */
  @IsObject()
  answers!: Record<string, number>;
}
