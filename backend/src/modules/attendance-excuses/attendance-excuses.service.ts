import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { GetAttendanceExcusesQueryDto } from './dto/get-attendance-excuses-query.dto';
import { CancelAttendanceExcuseDto } from './dto/cancel-attendance-excuse.dto';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';

import {
  AttendanceExcuse,
  AttendanceExcuseStatus,
} from './attendance-excuse.entity';
import { CreateAttendanceExcuseDto } from './dto/create-attendance-excuse.dto';

const MAX_PDF_SIZE = 5 * 1024 * 1024;

import { DashboardStatsQueue } from '../dashboard/dashboard-stats.queue';

@Injectable()
export class AttendanceExcusesService {
  private readonly directory = join(
    process.cwd(),
    'private_uploads',
    'attendance-excuses',
  );

  constructor(
    @InjectRepository(AttendanceExcuse)
    private readonly excusesRepository: Repository<AttendanceExcuse>,

    @InjectRepository(SchoolMembership)
    private readonly membershipsRepository: Repository<SchoolMembership>,

    private readonly statsQueue: DashboardStatsQueue,
  ) {}

  /** Ariza oralig‘idagi (bugungacha, ko‘pi bilan 62 kun) kunlar statistikasi qayta hisoblanadi. */
  private markStats(schoolId: number, startDate: string, endDate: string): void {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    const days: { schoolId: number; date: string }[] = [];
    const end = endDate < today ? endDate : today;
    for (let date = startDate; date <= end && days.length < 62; ) {
      days.push({ schoolId, date });
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
    void this.statsQueue.mark(days, 5_000);
  }

  async create(
    dto: CreateAttendanceExcuseDto,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ) {
    // Maktab administratori faqat o‘z maktabida.
    if (
      actor.role === UserRole.SCHOOL_ADMIN &&
      actor.schoolId !== dto.schoolId
    ) {
      throw new ForbiddenException(
        'Boshqa maktab uchun ariza yuklash mumkin emas',
      );
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF arizani tanlang');
    }

    if (file.size > MAX_PDF_SIZE || file.buffer.length > MAX_PDF_SIZE) {
      throw new BadRequestException('PDF hajmi 5 MB dan oshmasligi kerak');
    }

    // MIME va PDF sarlavhasini tekshiramiz.
    if (
      file.mimetype !== 'application/pdf' ||
      file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new BadRequestException(
        'Faqat PDF formatidagi ariza qabul qilinadi',
      );
    }

    // Tanlangan sana oralig‘i shu maktabdagi
    // o‘quvchilik davri bilan to‘liq qoplanishi kerak.
    const memberships = await this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.person', 'person')
      .where('membership.personId = :personId', {
        personId: dto.personId,
      })
      .andWhere('membership.schoolId = :schoolId', {
        schoolId: dto.schoolId,
      })
      .andWhere('membership.type = :type', {
        type: dto.membershipType,
      })
      .andWhere('person.deletedAt IS NULL')
      .andWhere('membership.startDate <= :endDate', {
        endDate: dto.endDate,
      })
      .andWhere(
        '(membership.endDate IS NULL OR membership.endDate > :startDate)',
        { startDate: dto.startDate },
      )
      .orderBy('membership.startDate', 'ASC')
      .getMany();

    // Sinf almashtirishda bir nechta ketma-ket
    // membership bo‘lishi mumkin.
    let coveredUntil = dto.startDate;

    for (const membership of memberships) {
      if (membership.startDate > coveredUntil) {
        break;
      }

      const membershipEnd = membership.endDate ?? '9999-12-31';

      if (membershipEnd > coveredUntil) {
        coveredUntil = membershipEnd;
      }

      if (coveredUntil > dto.endDate) {
        break;
      }
    }

    if (coveredUntil <= dto.endDate) {
      throw new BadRequestException(
        dto.membershipType === MembershipType.TEACHER
          ? 'Ariza sanalari o‘qituvchining ushbu maktabdagi ish davriga mos emas'
          : 'Ariza sanalari o‘quvchining ushbu maktabdagi o‘qish davriga mos emas',
      );
    }

    // Bir o‘quvchining bir xil kunlari uchun
    // ustma-ust faol arizalar kiritilmasin.
    const hasOverlap = await this.excusesRepository
      .createQueryBuilder('excuse')
      .where('excuse.personId = :personId', {
        personId: dto.personId,
      })
      .andWhere('excuse.schoolId = :schoolId', {
        schoolId: dto.schoolId,
      })
      .andWhere('excuse.membershipType = :membershipType', {
        membershipType: dto.membershipType,
      })
      .andWhere('excuse.status = :status', {
        status: AttendanceExcuseStatus.ACTIVE,
      })
      .andWhere('excuse.startDate <= :endDate', {
        endDate: dto.endDate,
      })
      .andWhere('excuse.endDate >= :startDate', {
        startDate: dto.startDate,
      })
      .getExists();

    if (hasOverlap) {
      throw new ConflictException(
        'Ushbu sana oralig‘ida faol sababli ariza mavjud',
      );
    }

    const filename = `${randomUUID()}.pdf`;

    const originalName =
      file.originalname.split(/[\\/]/).pop()?.slice(0, 255) || 'ariza.pdf';

    const pdfSha256 = createHash('sha256').update(file.buffer).digest('hex');

    await mkdir(this.directory, { recursive: true });

    const filePath = join(this.directory, filename);

    await writeFile(filePath, file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });

    try {
      const excuse = this.excusesRepository.create({
        personId: dto.personId,
        schoolId: dto.schoolId,
        membershipType: dto.membershipType,
        reason: dto.reason,
        reasonNote: dto.reasonNote ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,

        status: AttendanceExcuseStatus.ACTIVE,

        pdfPath: `private_uploads/attendance-excuses/${filename}`,
        pdfOriginalName: originalName,
        pdfSize: file.buffer.length,
        pdfSha256,

        uploadedByUserId: actor.id,
        cancelledByUserId: null,
        cancelledAt: null,
        cancellationReason: null,
      });

      const saved = await this.excusesRepository.save(excuse);
      this.markStats(saved.schoolId, saved.startDate, saved.endDate);

      // Ichki fayl manzilini mijozga qaytarmaymiz.
      return {
        id: saved.id,
        personId: saved.personId,
        schoolId: saved.schoolId,
        membershipType: saved.membershipType,
        reason: saved.reason,
        reasonNote: saved.reasonNote,
        startDate: saved.startDate,
        endDate: saved.endDate,
        status: saved.status,
        pdfOriginalName: saved.pdfOriginalName,
        uploadedByUserId: saved.uploadedByUserId,
        createdAt: saved.createdAt,
      };
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  private checkAccess(schoolId: number, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (actor.role === UserRole.SCHOOL_ADMIN && actor.schoolId === schoolId) {
      return;
    }

    throw new ForbiddenException(
      'Ushbu maktab arizalari bilan ishlashga ruxsat yo‘q',
    );
  }

  // Arizalar ro‘yxati
  async findAll(query: GetAttendanceExcusesQueryDto, actor: AuthenticatedUser) {
    const builder = this.excusesRepository
      .createQueryBuilder('excuse')
      .leftJoinAndSelect('excuse.person', 'person')
      .leftJoinAndSelect('excuse.school', 'school')
      .leftJoin('excuse.uploadedBy', 'uploadedBy')
      .addSelect([
        'uploadedBy.id',
        'uploadedBy.login',
        'uploadedBy.firstName',
        'uploadedBy.lastName',
      ]);

    if (actor.role === UserRole.SCHOOL_ADMIN) {
      if (!actor.schoolId) {
        throw new ForbiddenException('Hisobga maktab biriktirilmagan');
      }

      builder.andWhere('excuse.schoolId = :scopeSchoolId', {
        scopeSchoolId: actor.schoolId,
      });
    } else if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Ruxsat yo‘q');
    }

    if (query.schoolId !== undefined) {
      this.checkAccess(query.schoolId, actor);

      builder.andWhere('excuse.schoolId = :schoolId', {
        schoolId: query.schoolId,
      });
    }

    if (query.personId !== undefined) {
      builder.andWhere('excuse.personId = :personId', {
        personId: query.personId,
      });
    }

    if (query.status !== undefined) {
      builder.andWhere('excuse.status = :status', { status: query.status });
    }

    if (query.membershipType !== undefined) {
      builder.andWhere('excuse.membershipType = :membershipType', {
        membershipType: query.membershipType,
      });
    }

    // Tanlangan oraliq bilan kesishgan arizalar.
    if (query.from !== undefined) {
      builder.andWhere('excuse.endDate >= :filterFrom', {
        filterFrom: query.from,
      });
    }

    if (query.to !== undefined) {
      builder.andWhere('excuse.startDate <= :filterTo', {
        filterTo: query.to,
      });
    }

    if (query.q) {
      const words = query.q.split(/\s+/).filter(Boolean);

      words.forEach((word, index) => {
        const escaped = word.replace(/[!%_]/g, '!$&');
        const parameterName = `excuseSearch${index}`;

        builder.andWhere(
          `(
            person.firstName LIKE :${parameterName} ESCAPE '!'
            OR person.lastName LIKE :${parameterName} ESCAPE '!'
            OR person.middleName LIKE :${parameterName} ESCAPE '!'
            OR person.pnfl LIKE :${parameterName} ESCAPE '!'
          )`,
          { [parameterName]: `%${escaped}%` },
        );
      });
    }

    const [rows, total] = await builder
      .orderBy('excuse.createdAt', 'DESC')
      .addOrderBy('excuse.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const classNames = await this.loadClassNames(rows);

    return {
      data: rows.map((item) => ({
        id: item.id,
        personId: item.personId,
        schoolId: item.schoolId,
        membershipType: item.membershipType,
        className: classNames.get(item.id) ?? null,

        person: item.person
          ? {
              id: item.person.id,
              pnfl: item.person.pnfl,
              firstName: item.person.firstName,
              lastName: item.person.lastName,
              middleName: item.person.middleName,
            }
          : null,

        uploadedBy: item.uploadedBy
          ? {
              id: item.uploadedBy.id,
              name:
                [item.uploadedBy.lastName, item.uploadedBy.firstName]
                  .filter(Boolean)
                  .join(' ') || item.uploadedBy.login,
            }
          : null,

        school: {
          id: item.school.id,
          name: item.school.name,
        },

        reason: item.reason,
        reasonNote: item.reasonNote,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,

        pdfOriginalName: item.pdfOriginalName,
        uploadedByUserId: item.uploadedByUserId,
        cancelledByUserId: item.cancelledByUserId,
        cancelledAt: item.cancelledAt,
        cancellationReason: item.cancellationReason,
        createdAt: item.createdAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * O‘quvchi arizalari uchun ariza boshlangan kundagi sinf nomi.
   * Sahifadagi barcha arizalar uchun bitta so‘rov.
   */
  private async loadClassNames(
    rows: AttendanceExcuse[],
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const students = rows.filter(
      (row) => row.membershipType === MembershipType.STUDENT,
    );

    if (students.length === 0) {
      return result;
    }

    const memberships = await this.membershipsRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.schoolClass', 'schoolClass')
      .where('membership.personId IN (:...personIds)', {
        personIds: [...new Set(students.map((row) => row.personId))],
      })
      .andWhere('membership.type = :type', { type: MembershipType.STUDENT })
      .orderBy('membership.startDate', 'DESC')
      .addOrderBy('membership.id', 'DESC')
      .getMany();

    for (const row of students) {
      const membership = memberships.find(
        (item) =>
          item.personId === row.personId &&
          item.schoolId === row.schoolId &&
          item.startDate <= row.startDate &&
          (item.endDate === null || item.endDate > row.startDate),
      );

      if (membership?.schoolClass) {
        result.set(row.id, membership.schoolClass.name);
      }
    }

    return result;
  }

  // PDF arizani xavfsiz o‘qish
  async readPdf(id: number, actor: AuthenticatedUser): Promise<Buffer> {
    const excuse = await this.excusesRepository
      .createQueryBuilder('excuse')
      .addSelect('excuse.pdfPath')
      .where('excuse.id = :id', { id })
      .getOne();

    if (!excuse) {
      throw new NotFoundException('Ariza topilmadi');
    }

    this.checkAccess(excuse.schoolId, actor);

    // Faqat dastur yaratgan UUID formatidagi
    // fayl manziliga ruxsat beramiz.
    const match =
      /^private_uploads\/attendance-excuses\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pdf$/.exec(
        excuse.pdfPath,
      );

    if (!match) {
      throw new NotFoundException('PDF fayl manzili noto‘g‘ri');
    }

    const filePath = join(this.directory, `${match[1]}.pdf`);

    try {
      return await readFile(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('PDF fayl serverda topilmadi');
      }

      throw error;
    }
  }

  // Arizani bekor qilish
  async cancel(
    id: number,
    dto: CancelAttendanceExcuseDto,
    actor: AuthenticatedUser,
  ) {
    const excuse = await this.excusesRepository.findOneBy({
      id,
    });

    if (!excuse) {
      throw new NotFoundException('Ariza topilmadi');
    }

    this.checkAccess(excuse.schoolId, actor);

    if (excuse.status === AttendanceExcuseStatus.CANCELLED) {
      throw new ConflictException('Ushbu ariza allaqachon bekor qilingan');
    }

    const cancelledAt = new Date();

    const result = await this.excusesRepository
      .createQueryBuilder()
      .update(AttendanceExcuse)
      .set({
        status: AttendanceExcuseStatus.CANCELLED,
        cancelledByUserId: actor.id,
        cancelledAt,
        cancellationReason: dto.cancellationReason,
      })
      .where('id = :id', { id })
      .andWhere('status = :status', {
        status: AttendanceExcuseStatus.ACTIVE,
      })
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException('Ariza holati o‘zgargan. Qayta tekshiring.');
    }

    this.markStats(excuse.schoolId, excuse.startDate, excuse.endDate);

    return {
      id,
      status: AttendanceExcuseStatus.CANCELLED,
      cancelledByUserId: actor.id,
      cancelledAt,
      cancellationReason: dto.cancellationReason,
    };
  }
}
