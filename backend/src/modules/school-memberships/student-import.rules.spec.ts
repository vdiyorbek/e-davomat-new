import {
  cellText,
  mapHeaders,
  normalizeClassName,
  normalizeMahallaName,
  normalizePhone,
  parseBirthDate,
  parseGender,
} from './student-import.rules';

describe('student-import.rules', () => {
  it('mapHeaders sarlavhalarni topadi va yetishmayotganini aytadi', () => {
    const ok = mapHeaders([
      'PNFL',
      'Familiya',
      'Ism',
      'Mahalla',
      'Tug‘ilgan sana',
      'Sinf',
    ]);

    expect(ok.missing).toEqual([]);
    expect(ok.columns.birthDate).toBe(4);
    expect(ok.columns.className).toBe(5);

    const bad = mapHeaders(['Familiya', 'Ism']);

    expect(bad.missing).toEqual(['pnfl', 'mahalla']);
  });

  it('mapHeaders apostrof va rus sarlavhalarini qabul qiladi', () => {
    const result = mapHeaders([
      "Tug'ilgan sana",
      'ПИНФЛ',
      'Фамилия',
      'Имя',
      'Махалла',
    ]);

    expect(result.missing).toEqual([]);
    expect(result.columns.birthDate).toBe(0);
  });

  it('cellText', () => {
    expect(cellText('  abc ')).toBe('abc');
    expect(cellText(12345678901234)).toBe('12345678901234');
    expect(cellText({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
    expect(cellText({ result: 'x' })).toBe('x');
    expect(cellText(null)).toBe('');
  });

  it('parseGender', () => {
    expect(parseGender('Erkak')).toBe('MALE');
    expect(parseGender('ayol')).toBe('FEMALE');
    expect(parseGender('')).toBeNull();
    expect(parseGender('boshqa')).toBeUndefined();
  });

  it('parseBirthDate', () => {
    expect(parseBirthDate('2012-05-01')).toBe('2012-05-01');
    expect(parseBirthDate('01.05.2012')).toBe('2012-05-01');
    expect(parseBirthDate('1/5/2012')).toBe('2012-05-01');
    expect(parseBirthDate('31.02.2012')).toBeUndefined();
    expect(parseBirthDate('abc')).toBeUndefined();
    expect(parseBirthDate('')).toBeNull();
    expect(parseBirthDate(new Date('2012-05-01T00:00:00Z'))).toBe('2012-05-01');
    // Excel seriya raqami: 41000 = 2012-04-01
    expect(parseBirthDate(41000)).toBe('2012-04-01');
  });

  it('normalizePhone', () => {
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
    expect(normalizePhone('901234567')).toBe('+998901234567');
    expect(normalizePhone('998901234567')).toBe('+998901234567');
    expect(normalizePhone('+998 90 123-45-67')).toBe('+998901234567');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeUndefined();
  });

  it('normalizeClassName', () => {
    expect(normalizeClassName('5-a')).toBe('5A');
    expect(normalizeClassName('11 B')).toBe('11B');
  });

  it('normalizeMahallaName', () => {
    expect(normalizeMahallaName("Navro'z MFY")).toBe('navroz');
    expect(normalizeMahallaName('  Oqtepa  mahalla ')).toBe('oqtepa');
  });
});
