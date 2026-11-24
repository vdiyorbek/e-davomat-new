/** `unknown` qiymatni xavfsiz matnga aylantiradi (obyektlar bo‘sh qator bo‘ladi). */
export function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}
