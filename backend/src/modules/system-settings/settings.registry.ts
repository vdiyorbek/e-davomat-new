/**
 * Tizim sozlamalari ro‘yxati. Har sozlama: turi, ruxsat etilgan chegara va standart qiymat.
 * Standart qiymat — .env (agar berilgan bo‘lsa) yoki shu fayldagi son. Bazada qiymat
 * bo‘lsa, u ustun turadi. Bu fayl Nest'ga bog‘liq emas: push-ingest jarayoni ham ishlatadi.
 *
 * Parollar, kalitlar va manzillar bu yerga KIRMAYDI — ular faqat .env'da turadi.
 */
export type SettingGroup = 'photos' | 'push' | 'lag' | 'live' | 'calendar';
export type SettingValue = number | boolean;

export interface SettingDefinition {
  key: string;
  group: SettingGroup;
  type: 'int' | 'bool';
  min?: number;
  max?: number;
  unit?: 'seconds' | 'minutes' | 'days' | 'count' | 'grade';
  /** Standart qiymat (muhit o‘zgaruvchisi hisobga olinadi). */
  getDefault: () => SettingValue;
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && process.env[name] !== '' ? value : fallback;
}

const envBoolDefaultTrue = (name: string) => () =>
  process.env[name] !== 'false';

export const SETTINGS: SettingDefinition[] = [
  // — Rasmlar —
  {
    key: 'photosConcurrency',
    group: 'photos',
    type: 'int',
    min: 1,
    max: 6,
    unit: 'count',
    getDefault: () => 1,
  },
  {
    key: 'photosWorkers',
    group: 'photos',
    type: 'int',
    min: 1,
    max: 12,
    unit: 'count',
    getDefault: () => 2,
  },
  {
    key: 'photosBatchSize',
    group: 'photos',
    type: 'int',
    min: 1,
    max: 20,
    unit: 'count',
    getDefault: () => 5,
  },
  {
    key: 'photosMaxBatches',
    group: 'photos',
    type: 'int',
    min: 1,
    max: 60,
    unit: 'count',
    getDefault: () => 20,
  },
  {
    key: 'photosRunSeconds',
    group: 'photos',
    type: 'int',
    min: 10,
    max: 55,
    unit: 'seconds',
    getDefault: () => 45,
  },
  // — Push qabul qilish —
  {
    key: 'pushSavePictures',
    group: 'push',
    type: 'bool',
    getDefault: envBoolDefaultTrue('PUSH_SAVE_PICTURES'),
  },
  {
    key: 'pushMaxRpsPerTerminal',
    group: 'push',
    type: 'int',
    min: 1,
    max: 1000,
    unit: 'count',
    getDefault: () => envInt('PUSH_MAX_RPS_PER_TERMINAL', 30),
  },
  {
    key: 'pushMaxBacklog',
    group: 'push',
    type: 'int',
    min: 1000,
    max: 100_000_000,
    unit: 'count',
    getDefault: () => envInt('PUSH_MAX_BACKLOG', 1_000_000),
  },
  // — Kechikkan terminal —
  {
    key: 'pushLagReconcile',
    group: 'lag',
    type: 'bool',
    getDefault: envBoolDefaultTrue('PUSH_LAG_RECONCILE'),
  },
  {
    key: 'pushLagMinutes',
    group: 'lag',
    type: 'int',
    min: 1,
    max: 180,
    unit: 'minutes',
    getDefault: () => 10,
  },
  {
    key: 'pushPhotoLookup',
    group: 'lag',
    type: 'bool',
    getDefault: envBoolDefaultTrue('PUSH_PHOTO_LOOKUP'),
  },
  {
    key: 'pushPhotoLookupDays',
    group: 'lag',
    type: 'int',
    min: 1,
    max: 365,
    unit: 'days',
    getDefault: () => envInt('PUSH_PHOTO_LOOKUP_DAYS', 30),
  },
  // — Jonli efir —
  {
    key: 'liveMaxAgeMinutes',
    group: 'live',
    type: 'int',
    min: 1,
    max: 180,
    unit: 'minutes',
    getDefault: () => 10,
  },
  // — Standart o‘quv haftasi (haftalik jadval kiritilmagan maktab/sinflar uchun) —
  {
    key: 'calendarPrimaryMaxGrade',
    group: 'calendar',
    type: 'int',
    min: 1,
    max: 11,
    unit: 'grade',
    getDefault: () => 4,
  },
  {
    key: 'calendarPrimaryWeekDays',
    group: 'calendar',
    type: 'int',
    min: 1,
    max: 7,
    unit: 'days',
    getDefault: () => 5,
  },
  {
    key: 'calendarGeneralWeekDays',
    group: 'calendar',
    type: 'int',
    min: 1,
    max: 7,
    unit: 'days',
    getDefault: () => 6,
  },
];

export const SETTING_KEYS = SETTINGS.map((setting) => setting.key);

export function findSetting(key: string): SettingDefinition | undefined {
  return SETTINGS.find((setting) => setting.key === key);
}

/**
 * Kelgan qiymatni (JSON son/mantiqiy yoki bazadagi matn) tekshiradi.
 * Yaroqsiz bo‘lsa null qaytaradi — chaqiruvchi xato beradi yoki standartni ishlatadi.
 */
export function parseSettingValue(
  definition: SettingDefinition,
  raw: unknown,
): SettingValue | null {
  if (definition.type === 'bool') {
    if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
    if (raw === false || raw === 'false' || raw === 0 || raw === '0')
      return false;
    return null;
  }
  const value =
    typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (definition.min !== undefined && value < definition.min) return null;
  if (definition.max !== undefined && value > definition.max) return null;
  return value;
}

export const serializeSettingValue = (value: SettingValue): string =>
  String(value);
