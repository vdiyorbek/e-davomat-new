import { ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { UserRole } from '../users/enums/user-role.enum';

import type { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { StudentImportService } from './student-import.service';

async function makeFile(rows: unknown[][]): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  rows.forEach((row) => sheet.addRow(row));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    originalname: 'students.xlsx',
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}

const HEADER = [
  'PNFL',
  'Familiya',
  'Ism',
  'Jinsi',
  'Tug‘ilgan sana',
  'Telefon',
  'Mahalla',
  'Sinf',
];

function setup(existingPnfls: string[] = []) {
  const create = jest
    .fn<Promise<unknown>, [CreateSchoolStudentDto]>()
    .mockResolvedValue({});
  const service = new StudentImportService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        districtId: 5,
        district: { regionId: 2 },
      }),
    } as never,
    {
      find: jest.fn().mockResolvedValue([
        { id: 1, name: 'Navro‘z' },
        { id: 2, name: 'Oqtepa MFY' },
      ]),
    } as never,
    {
      find: jest.fn().mockResolvedValue([
        { id: 100, name: '5A', academicYear: '2025-2026' },
        { id: 101, name: '5A', academicYear: '2026-2027' },
      ]),
    } as never,
    {
      find: jest
        .fn()
        .mockResolvedValue(existingPnfls.map((pnfl) => ({ pnfl }))),
    } as never,
    { create } as never,
  );
  const admin = {
    id: 1,
    role: UserRole.SCHOOL_ADMIN,
    schoolId: 10,
    districtId: 5,
    regionId: 2,
  } as never;

  return { service, create, admin };
}

describe('StudentImportService', () => {
  it('tekshiruv rejimida hech narsa yaratmaydi va xatolarni qator bilan qaytaradi', async () => {
    const { service, create, admin } = setup(['33333333333333']);
    const file = await makeFile([
      HEADER,
      [
        '11111111111111',
        'Karimov',
        'Ali',
        'Erkak',
        '15.03.2014',
        '901234567',
        'Navroz',
        '5-a',
      ],
      ['11111111111111', 'Karimov', 'Vali', '', '', '', 'Oqtepa', ''],
      [
        '22222222222222',
        'Aliyeva',
        'Zilola',
        'qiz',
        '',
        '',
        'Yo‘q mahalla',
        '',
      ],
      ['33333333333333', 'Sobirov', 'Jasur', '', '', '', 'Navroz', ''],
      ['123', 'Noto‘g‘ri', 'Pnfl', '', '', '', 'Navroz', ''],
    ]);

    const report = await service.run(file, {}, admin);

    expect(create).not.toHaveBeenCalled();
    expect(report.applied).toBe(false);
    expect(report.total).toBe(5);
    expect(report.valid).toBe(1);
    expect(report.errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(report.errors[0].message).toContain('takrorlangan');
    expect(report.errors[1].message).toContain('Mahalla topilmadi');
    expect(report.errors[2].message).toContain('allaqachon mavjud');
  });

  it('apply bilan faqat to‘g‘ri qatorlarni yaratadi, sinf va mahalla id sini aniqlaydi', async () => {
    const { service, create, admin } = setup();
    const file = await makeFile([
      HEADER,
      [
        '11111111111111',
        'Karimov',
        'Ali',
        'Erkak',
        '15.03.2014',
        '901234567',
        'Navroz',
        '5-a',
      ],
      [
        '22222222222222',
        'Aliyeva',
        'Zilola',
        'Ayol',
        '',
        '',
        'Oqtepa mahalla',
        '',
      ],
    ]);

    const report = await service.run(file, { apply: true }, admin);

    expect(report.created).toBe(2);
    expect(report.failed).toBe(0);

    const first = create.mock.calls[0][0];

    expect(first).toMatchObject({
      schoolId: 10,
      classId: 101,
      mahallaId: 1,
      gender: 'MALE',
      birthDate: '2014-03-15',
      phoneNumber: '+998901234567',
    });
    expect(create.mock.calls[1][0]).toMatchObject({
      mahallaId: 2,
      classId: null,
    });
  });

  it('majburiy ustun yetishmasa rad etadi', async () => {
    const { service, admin } = setup();
    const file = await makeFile([
      ['PNFL', 'Ism'],
      ['11111111111111', 'Ali'],
    ]);

    await expect(service.run(file, {}, admin)).rejects.toThrow('topilmadi');
  });

  it('boshqa maktabga yuklashga ruxsat bermaydi', async () => {
    const { service, admin } = setup();
    const file = await makeFile([HEADER]);

    await expect(service.run(file, { schoolId: 99 }, admin)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('xlsx bo‘lmagan faylni rad etadi', async () => {
    const { service, admin } = setup();

    await expect(
      service.run(
        { originalname: 'a.xlsx', buffer: Buffer.from('not zip') } as never,
        {},
        admin,
      ),
    ).rejects.toThrow('.xlsx');
  });
});
