import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/** O‘zbekiston chegarasi (ozgina zaxira bilan): shundan tashqari koordinata rad etiladi. */
export const LAT_MIN = 36.9;
export const LAT_MAX = 45.8;
export const LNG_MIN = 55.8;
export const LNG_MAX = 73.4;

const toNumberOrNull = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null) return null;
  const number =
    typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  // Google Maps 7+ kasr raqam beradi: oltitagacha yaxlitlanadi (~10 sm aniqlik).
  return typeof number === 'number' && Number.isFinite(number)
    ? Math.round(number * 1e6) / 1e6
    : number;
};

/** Kenglik: bo‘sh/null — lokatsiyani o‘chirish. */
export function Latitude() {
  return (target: object, key: string) => {
    Transform(toNumberOrNull)(target, key);
    IsOptional()(target, key);
    IsNumber({}, { message: 'Kenglik son bo‘lishi kerak' })(target, key);
    Min(LAT_MIN, {
      message: `Kenglik ${LAT_MIN}–${LAT_MAX} oralig‘ida bo‘lishi kerak`,
    })(target, key);
    Max(LAT_MAX, {
      message: `Kenglik ${LAT_MIN}–${LAT_MAX} oralig‘ida bo‘lishi kerak`,
    })(target, key);
  };
}

export function Longitude() {
  return (target: object, key: string) => {
    Transform(toNumberOrNull)(target, key);
    IsOptional()(target, key);
    IsNumber({}, { message: 'Uzunlik son bo‘lishi kerak' })(target, key);
    Min(LNG_MIN, {
      message: `Uzunlik ${LNG_MIN}–${LNG_MAX} oralig‘ida bo‘lishi kerak`,
    })(target, key);
    Max(LNG_MAX, {
      message: `Uzunlik ${LNG_MIN}–${LNG_MAX} oralig‘ida bo‘lishi kerak`,
    })(target, key);
  };
}
