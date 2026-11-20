import { Latitude, Longitude } from './school-location';

/** Maktab lokatsiyasini o‘zgartirish: ikkalasi qiymatli yoki ikkalasi null (o‘chirish). */
export class SchoolLocationDto {
  @Latitude()
  latitude?: number | null;

  @Longitude()
  longitude?: number | null;
}
