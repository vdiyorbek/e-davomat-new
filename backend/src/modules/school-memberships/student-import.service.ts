import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { SchoolClass } from '../classes/school-class.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { ImportSchoolStudentsDto } from './dto/import-school-students.dto';
import { SchoolStudentsService } from './school-students.service';
import { canCreateStudentIn } from './school-students.rules';
import {
  IMPORT_HEADERS,
  cellText,
  mapHeaders,
  normalizeClassName,
  normalizeMahallaName,
  normalizePhone,
  parseBirthDate,
  parseGender,
} from './student-import.rules';
import type { ImportField } from './student-import.rules';

export const MAX_IMPORT_ROWS = 1000;
const MAX_SHEET_ROWS = 5000;
const PNFL_CHUNK = 500;

export interface ImportRowError {
  row: number;
  pnfl: string;
  message: string;
}

export interface StudentImportReport {
  applied: boolean;
  total: number;
  valid: number;
  created: number;
  failed: number;
  errors: ImportRowError[];
}

interface Candidate {
  row: number;
  pnfl: string;
  dto: CreateSchoolStudentDto | null;
  error?: string;
}

@Injectable()
export class StudentImportService {
  constructor(
    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,
    @InjectRepository(Mahalla)
    private readonly mahallasRepository: Repository<Mahalla>,
    @InjectRepository(SchoolClass)
    private readonly classesRepository: Repository<SchoolClass>,
    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,
    private readonly studentsService: SchoolStudentsService,
  ) {}

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('O‘quvchilar');
    const headers = Object.values(IMPORT_HEADERS);

    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    headers.forEach((header, index) => {
      sheet.getColumn(index + 1).width = Math.max(16, header.length + 6);
    });
    // PNFL va telefon matn sifatida saqlansin (bosh nol va uzun raqamlar yo'qolmasin).
    sheet.getColumn(1).numFmt = '@';
    sheet.getColumn(7).numFmt = '@';

    const guide = workbook.addWorksheet('Qo‘llanma');
    guide.getColumn(1).width = 22;
    guide.getColumn(2).width = 80;
    guide.addRows([
      ['Ustun', 'Izoh'],
      ['PNFL *', '14 ta raqam. Masalan: 12345678901234'],
      ['Familiya *', 'Masalan: Karimov'],
      ['Ism *', 'Masalan: Ali'],
      ['Otasining ismi', 'Ixtiyoriy'],
      ['Jinsi', 'Erkak yoki Ayol (ixtiyoriy)'],
      [
        'Tug‘ilgan sana',
        'KK.OO.YYYY yoki YYYY-OO-KK, masalan 15.03.2014 (ixtiyoriy)',
      ],
      ['Telefon', '+998901234567 yoki 901234567 (ixtiyoriy)'],
      ['Manzil', 'Ixtiyoriy'],
      [
        'Mahalla *',
        'Maktab joylashgan tumandagi mahalla nomi, masalan: Navro‘z',
      ],
      [
        'Sinf',
        'Ixtiyoriy, masalan: 5A. Maktabning eng so‘nggi o‘quv yilidagi sinf olinadi',
      ],
      ['', ''],
      [
        'Muhim',
        'Birinchi varaqdagi sarlavhalarni o‘zgartirmang. Bir faylda ko‘pi bilan 1000 ta o‘quvchi.',
      ],
    ]);
    guide.getRow(1).font = { bold: true };

    const data = await workbook.xlsx.writeBuffer();

    return Buffer.from(data);
  }

  async run(
    file: Express.Multer.File | undefined,
    dto: ImportSchoolStudentsDto,
    user: AuthenticatedUser,
  ): Promise<StudentImportReport> {
    const school = await this.resolveSchool(dto.schoolId, user);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel faylni yuklang');
    }

    const isXlsx =
      file.originalname.toLowerCase().endsWith('.xlsx') &&
      file.buffer[0] === 0x50 &&
      file.buffer[1] === 0x4b;

    if (!isXlsx) {
      throw new BadRequestException('Faqat .xlsx fayl qabul qilinadi');
    }

    const worksheet = await this.readWorksheet(file.buffer);
    const headers: string[] = [];

    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      headers.push(cellText(worksheet.getRow(1).getCell(column).value));
    }

    const mapping = mapHeaders(headers);

    if (mapping.missing.length > 0) {
      throw new BadRequestException(
        `Quyidagi ustunlar topilmadi: ${mapping.missing
          .map((field) => IMPORT_HEADERS[field])
          .join(', ')}`,
      );
    }

    if (worksheet.rowCount > MAX_SHEET_ROWS) {
      throw new BadRequestException('Fayl juda katta');
    }

    const [mahallaIndex, classIndex] = await Promise.all([
      this.loadMahallaIndex(school.districtId),
      this.loadClassIndex(school.id),
    ]);

    const candidates: Candidate[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const text = (field: ImportField): string => {
        const column = mapping.columns[field];

        return column === undefined
          ? ''
          : cellText(row.getCell(column + 1).value);
      };

      const values = (Object.keys(IMPORT_HEADERS) as ImportField[]).map(
        (field) => text(field),
      );

      if (values.every((value) => value === '')) continue;

      candidates.push(
        await this.buildCandidate(
          rowNumber,
          text,
          () => {
            const column = mapping.columns.birthDate;

            return column === undefined ? null : row.getCell(column + 1).value;
          },
          school,
          mahallaIndex,
          classIndex,
        ),
      );
    }

    if (candidates.length === 0) {
      throw new BadRequestException('Faylda o‘quvchi qatorlari topilmadi');
    }

    if (candidates.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Bir faylda ko‘pi bilan ${MAX_IMPORT_ROWS} ta o‘quvchi bo‘lishi mumkin`,
      );
    }

    await this.markDuplicates(candidates);

    const errors: ImportRowError[] = [];
    const valid: Candidate[] = [];

    for (const candidate of candidates) {
      if (candidate.error) {
        errors.push({
          row: candidate.row,
          pnfl: candidate.pnfl,
          message: candidate.error,
        });
      } else if (candidate.dto) {
        valid.push(candidate);
      }
    }

    return this.finish(dto.apply === true, candidates, valid, errors, user);
  }

  private async finish(
    apply: boolean,
    candidates: Candidate[],
    valid: Candidate[],
    errors: ImportRowError[],
    user: AuthenticatedUser,
  ): Promise<StudentImportReport> {
    let created = 0;

    if (apply) {
      for (const candidate of valid) {
        if (!candidate.dto) continue;

        try {
          await this.studentsService.create(candidate.dto, user);
          created += 1;
        } catch (error: unknown) {
          errors.push({
            row: candidate.row,
            pnfl: candidate.pnfl,
            message:
              error instanceof HttpException
                ? error.message
                : 'Saqlashda kutilmagan xatolik',
          });
        }
      }
    }

    errors.sort((a, b) => a.row - b.row);

    return {
      applied: apply,
      total: candidates.length,
      valid: valid.length,
      created,
      failed: errors.length,
      errors,
    };
  }

  private async resolveSchool(
    requestedSchoolId: number | undefined,
    user: AuthenticatedUser,
  ): Promise<School> {
    let schoolId = requestedSchoolId;

    if (user.role === UserRole.SCHOOL_ADMIN) {
      if (!user.schoolId) {
        throw new ForbiddenException('Hisobga maktab biriktirilmagan');
      }

      if (schoolId !== undefined && schoolId !== user.schoolId) {
        throw new ForbiddenException('Faqat o‘z maktabingizga yuklay olasiz');
      }

      schoolId = user.schoolId;
    }

    if (schoolId === undefined) {
      throw new BadRequestException('Maktabni tanlang');
    }

    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      relations: { district: true },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const allowed = canCreateStudentIn(user, {
      id: school.id,
      districtId: school.districtId,
      regionId: school.district.regionId,
    });

    if (!allowed) {
      throw new ForbiddenException(
        'Ushbu maktabga o‘quvchi qo‘shishga ruxsat yo‘q',
      );
    }

    return school;
  }

  private async readWorksheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    try {
      const workbook = new ExcelJS.Workbook();

      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error('empty');
      }

      return worksheet;
    } catch {
      throw new BadRequestException(
        'Excel faylni o‘qib bo‘lmadi. Shablondan foydalaning',
      );
    }
  }

  /** Mahalla nomi -> id ro'yxati (bir xil nomli bo'lsa, bir nechta). */
  private async loadMahallaIndex(
    districtId: number,
  ): Promise<Map<string, number[]>> {
    const mahallas = await this.mahallasRepository.find({
      select: { id: true, name: true },
      where: { districtId, isActive: true },
    });
    const index = new Map<string, number[]>();

    for (const mahalla of mahallas) {
      const key = normalizeMahallaName(mahalla.name);
      index.set(key, [...(index.get(key) ?? []), mahalla.id]);
    }

    return index;
  }

  /** Sinf nomi -> eng so'nggi o'quv yilidagi sinf id si. */
  private async loadClassIndex(schoolId: number): Promise<Map<string, number>> {
    const classes = await this.classesRepository.find({
      select: { id: true, name: true, academicYear: true },
      where: { schoolId },
    });
    const latest = new Map<string, { id: number; academicYear: string }>();

    for (const schoolClass of classes) {
      const key = normalizeClassName(schoolClass.name);
      const current = latest.get(key);

      if (!current || schoolClass.academicYear > current.academicYear) {
        latest.set(key, {
          id: schoolClass.id,
          academicYear: schoolClass.academicYear,
        });
      }
    }

    return new Map([...latest].map(([key, value]) => [key, value.id]));
  }

  private async buildCandidate(
    row: number,
    text: (field: ImportField) => string,
    rawBirthDate: () => unknown,
    school: School,
    mahallaIndex: Map<string, number[]>,
    classIndex: Map<string, number>,
  ): Promise<Candidate> {
    const pnfl = text('pnfl').replace(/\s/g, '');
    const fail = (error: string): Candidate => ({
      row,
      pnfl,
      dto: null,
      error,
    });

    const gender = parseGender(text('gender'));

    if (gender === undefined) {
      return fail(`Jinsi noto‘g‘ri: "${text('gender')}" (Erkak yoki Ayol)`);
    }

    const birthDate = parseBirthDate(rawBirthDate());

    if (birthDate === undefined) {
      return fail('Tug‘ilgan sana noto‘g‘ri (masalan: 15.03.2014)');
    }

    const phoneNumber = normalizePhone(text('phoneNumber'));

    if (phoneNumber === undefined) {
      return fail(`Telefon noto‘g‘ri: "${text('phoneNumber')}"`);
    }

    const mahallaName = text('mahalla');
    const mahallaIds = mahallaIndex.get(normalizeMahallaName(mahallaName));

    if (!mahallaIds || mahallaIds.length === 0) {
      return fail(
        `Mahalla topilmadi: "${mahallaName}" (maktab tumanidagi mahalla nomi kerak)`,
      );
    }

    if (mahallaIds.length > 1) {
      return fail(`Mahalla nomi bir necha marta uchraydi: "${mahallaName}"`);
    }

    const className = text('className');
    let classId: number | null = null;

    if (className !== '') {
      const found = classIndex.get(normalizeClassName(className));

      if (found === undefined) {
        return fail(`Sinf topilmadi: "${className}"`);
      }

      classId = found;
    }

    const instance = plainToInstance(CreateSchoolStudentDto, {
      schoolId: school.id,
      classId,
      pnfl,
      firstName: text('firstName'),
      lastName: text('lastName'),
      middleName: text('middleName') || null,
      gender,
      birthDate,
      address: text('address') || null,
      phoneNumber,
      mahallaId: mahallaIds[0],
    });

    const problems = await validate(instance, { whitelist: true });
    const message = problems
      .flatMap((problem) => Object.values(problem.constraints ?? {}))
      .at(0);

    if (message) {
      return fail(message);
    }

    return { row, pnfl, dto: instance };
  }

  private async markDuplicates(candidates: Candidate[]): Promise<void> {
    const seen = new Map<string, number>();

    for (const candidate of candidates) {
      if (!candidate.dto || candidate.error) continue;

      const first = seen.get(candidate.pnfl);

      if (first !== undefined) {
        candidate.error = `PNFL faylda takrorlangan (${first}-qatorda ham bor)`;
      } else {
        seen.set(candidate.pnfl, candidate.row);
      }
    }

    const pnfls = [...seen.keys()];

    for (let start = 0; start < pnfls.length; start += PNFL_CHUNK) {
      const existing = await this.personsRepository.find({
        select: { pnfl: true },
        where: { pnfl: In(pnfls.slice(start, start + PNFL_CHUNK)) },
        withDeleted: true,
      });
      const taken = new Set(existing.map((person) => person.pnfl));

      for (const candidate of candidates) {
        if (taken.has(candidate.pnfl) && !candidate.error) {
          candidate.error =
            'Bu PNFL tizimda allaqachon mavjud. Tuman adminiga murojaat qiling';
        }
      }
    }
  }
}
