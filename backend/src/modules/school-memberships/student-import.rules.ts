export type ImportField =
  | 'pnfl'
  | 'lastName'
  | 'firstName'
  | 'middleName'
  | 'gender'
  | 'birthDate'
  | 'phoneNumber'
  | 'address'
  | 'mahalla'
  | 'className';

export const REQUIRED_IMPORT_FIELDS: ImportField[] = [
  'pnfl',
  'lastName',
  'firstName',
  'mahalla',
];

export const IMPORT_HEADERS: Record<ImportField, string> = {
  pnfl: 'PNFL',
  lastName: 'Familiya',
  firstName: 'Ism',
  middleName: 'Otasining ismi',
  gender: 'Jinsi',
  birthDate: 'Tug‘ilgan sana',
  phoneNumber: 'Telefon',
  address: 'Manzil',
  mahalla: 'Mahalla',
  className: 'Sinf',
};

const HEADER_ALIASES: Record<ImportField, string[]> = {
  pnfl: ['pnfl', 'jshshir', 'пинфл'],
  lastName: ['familiya', 'фамилия', 'lastname'],
  firstName: ['ism', 'имя', 'firstname'],
  middleName: ['otasining ismi', 'sharif', 'отчество', 'middlename'],
  gender: ['jinsi', 'jins', 'пол', 'gender'],
  birthDate: ['tugilgan sana', 'tugilgan sanasi', 'дата рождения', 'birthdate'],
  phoneNumber: ['telefon', 'телефон', 'phone'],
  address: ['manzil', 'адрес', 'address'],
  mahalla: ['mahalla', 'махалла'],
  className: ['sinf', 'класс', 'class'],
};

const APOSTROPHES = /[‘’ʻʼ'`´]/g;

/** Sarlavhani solishtirish uchun: kichik harf, apostrofsiz, bitta bo'sh joy. */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface HeaderMapping {
  columns: Partial<Record<ImportField, number>>;
  missing: ImportField[];
}

/** Sarlavha qatoridan ustun raqamlarini topadi (0 dan boshlanadi). */
export function mapHeaders(headers: string[]): HeaderMapping {
  const normalized = headers.map(normalizeHeader);
  const columns: Partial<Record<ImportField, number>> = {};

  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    const index = normalized.findIndex((header) =>
      HEADER_ALIASES[field].includes(header),
    );

    if (index !== -1) {
      columns[field] = index;
    }
  }

  return {
    columns,
    missing: REQUIRED_IMPORT_FIELDS.filter(
      (field) => columns[field] === undefined,
    ),
  };
}

/** Excel katakchasidagi qiymatni matnga aylantiradi. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') return value.trim();

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') return '';

  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part: { text?: unknown }) =>
          typeof part.text === 'string' ? part.text : '',
        )
        .join('')
        .trim();
    }

    if ('result' in record) return cellText(record.result);
    if (typeof record.text === 'string') return record.text.trim();
  }

  return '';
}

export function parseGender(
  value: string,
): 'MALE' | 'FEMALE' | null | undefined {
  const text = normalizeHeader(value);

  if (text === '') return null;

  if (
    [
      'erkak',
      'oglon',
      'ogil',
      'o',
      'e',
      'm',
      'male',
      'муж',
      'мужской',
      'эркак',
    ].includes(text)
  ) {
    return 'MALE';
  }

  if (
    ['ayol', 'qiz', 'a', 'q', 'f', 'female', 'жен', 'женский', 'аёл'].includes(
      text,
    )
  ) {
    return 'FEMALE';
  }

  return undefined;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** YYYY-MM-DD qaytaradi; bo'sh bo'lsa null; noto'g'ri bo'lsa undefined. */
export function parseBirthDate(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime())
      ? undefined
      : raw.toISOString().slice(0, 10);
  }

  if (typeof raw === 'number') {
    // Excel seriya raqami (1900 sanalar tizimi).
    if (!Number.isFinite(raw) || raw < 1 || raw > 80000) return undefined;

    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000);

    return date.toISOString().slice(0, 10);
  }

  const text = cellText(raw);

  if (text === '') return null;

  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (match) {
    const [year, month, day] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ];

    return isRealDate(year, month, day) ? text : undefined;
  }

  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);

  if (match) {
    const [day, month, year] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ];

    return isRealDate(year, month, day)
      ? `${year}-${pad(month)}-${pad(day)}`
      : undefined;
  }

  return undefined;
}

/** +998901234567 ko'rinishiga keltiradi; bo'sh bo'lsa null; noto'g'ri bo'lsa undefined. */
export function normalizePhone(value: string): string | null | undefined {
  const text =