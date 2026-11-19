import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';
import {
  SchoolMembership,
  MembershipType,
} from '../school-memberships/school-membership.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdateLessonScheduleDto } from './dto/update-lesson-schedule.dto';
import { LessonSchedule } from './lesson-schedule.entity';
import { CreateLessonScheduleDto } from './dto/create-lesson-schedule.dto';
import { ListLessonSchedulesDto } from './dto/list-lesson-schedules.dto';
import { TeacherLoadQueryDto } from './dto/teacher-load-query.dto';

@Injectable()
export class LessonSchedulesService {
  constructor(private readonly dataSource: DataSource) {}

  private async checkSchoolAccess(
    schoolId: number,
    user: AuthenticatedUser,
    manager: EntityManager,
  ): Promise<void> {
    const school = await manager.findOne(School, {
      where: { id: schoolId },
      relations: { district: true },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.REGION_ADMIN &&
        user.regionId === school.district.regionId) ||
      (user.role === UserRole.DISTRICT_ADMIN &&
        user.districtId === school.districtId) ||
      (user.role === UserRole.SCHOOL_ADMIN && user.schoolId === school.id);

    if (!allowed) {
      throw new ForbiddenException(
        'Ushbu maktab dars jadvalini boshqarishga ruxsat yo‘q',
      );
    }
  }

  private checkAcademicYear(
    academicYear: string,
    startDate: string,
    endDate: string | null,
  ): void {
    const match = /^(\d{4})-(\d{4})$/.exec(academicYear);

    if (!match) {
      throw new BadRequestException('O‘quv yili noto‘g‘ri');
    }

    const startYear = Number(match[1]);
    const endYear = Number(match[2]);

    if (startYear < 2000 || endYear > 2100 || endYear !== startYear + 1) {
      throw new BadRequestException('O‘quv yili noto‘g‘ri');
    }

    const yearStart = `${startYear}-09-01`;
    const yearEnd = `${endYear}-09-01`;

    if (
      startDate < yearStart ||
      startDate >= yearEnd ||
      (endDate !== null && endDate > yearEnd)
    ) {
      throw new BadRequestException(
        'Dars jadvali sanalari o‘quv yiliga mos emas',
      );
    }
  }

  /**
   * O‘qituvchilar haftalik yuklamasi. Har bir fan-sinf biriktirmasi uchun
   * o‘quv rejasidagi soat (weeklyHours) va jadvalga haqiqatda qo‘yilgan
   * darslar soni, hamda hafta kunlari bo‘yicha taqsimot.
   */
  async teacherLoad(dto: TeacherLoadQueryDto, user: AuthenticatedUser) {
    await this.checkSchoolAccess(dto.schoolId, user, this.dataSource.manager);

    const match = /^(\d{4})-(\d{4})$/.exec(dto.academicYear);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
      throw new BadRequestException('O‘quv yili noto‘g‘ri');
    }

    const yearStart = `${match[1]}-09-01`;
    const yearLast = `${match[2]}-08-31`;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
    }).format(new Date());
    // Bugun o‘quv yilidan tashqarida bo‘lsa, yilning chegarasini olamiz.
    const date =
      dto.date ??
      (today < yearStart ? yearStart : today > yearLast ? yearLast : today);

    const rows: {
      assignmentId: number;
      teacherMembershipId: number;
      personId: number;
      firstName: string;
      lastName: string;
      middleName: string | null;
      classId: number;
      className: string;
      subjectId: number;
      subjectName: string;
      weeklyHours: number | null;
      scheduled: string | number;
    }[] = await this.dataSource.query(
      `SELECT a.id AS assignmentId, a.teacherMembershipId, p.id AS personId,
              p.firstName, p.lastName, p.middleName,
              c.id AS classId, c.name AS className,
              s.id AS subjectId, s.nameUz AS subjectName, a.weeklyHours,
              (SELECT COUNT(*) FROM lesson_schedules ls
                WHERE ls.teacherAssignmentId = a.id AND ls.isActive = 1
                  AND ls.startDate <= ? AND (ls.endDate IS NULL OR ls.endDate > ?)
              ) AS scheduled
         FROM teacher_class_subjects a
         JOIN school_memberships m ON m.id = a.teacherMembershipId
         JOIN persons p ON p.id = m.personId
         JOIN school_classes c ON c.id = a.classId
         JOIN curriculum_subjects s ON s.id = a.subjectId
        WHERE c.schoolId = ? AND m.schoolId = ? AND c.academicYear = ?
          AND a.startDate <= ? AND (a.endDate IS NULL OR a.endDate > ?)
        ORDER BY p.lastName, p.firstName, c.name, s.nameUz`,
      [date, date, dto.schoolId, dto.schoolId, dto.academicYear, date, date],
    );

    const days: {
      teacherMembershipId: number;
      dayOfWeek: number;
      lessons: string | number;
    }[] = await this.dataSource.query(
      `SELECT a.teacherMembershipId, ls.dayOfWeek, COUNT(*) AS lessons
         FROM lesson_schedules ls
         JOIN teacher_class_subjects a ON a.id = ls.teacherAssignmentId
         JOIN school_classes c ON c.id = ls.classId
        WHERE c.schoolId = ? AND c.academicYear = ? AND ls.isActive = 1
          AND ls.startDate <= ? AND (ls.endDate IS NULL OR ls.endDate > ?)
        GROUP BY a.teacherMembershipId, ls.dayOfWeek`,
      [dto.schoolId, dto.academicYear, date, date],
    );

    const teachers = new Map<
      number,
      {
        teacherMembershipId: number;
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        plannedHours: number;
        scheduledHours: number;
        byDay: number[];
        assignments: {
          id: number;
          classId: number;
          className: string;
          subjectId: number;
          subjectName: string;
          weeklyHours: number | null;
          scheduled: number;
        }[];
      }
    >();

    for (const row of rows) {
      const key = Number(row.teacherMembershipId);
      let teacher = teachers.get(key);
      if (!teacher) {
        teacher = {
          teacherMembershipId: key,
          personId: Number(row.personId),
          firstName: row.firstName,
          lastName: row.lastName,
          middleName: row.middleName,
          plannedHours: 0,
          scheduledHours: 0,
          byDay: [0, 0, 0, 0, 0, 0],
          assignments: [],
        };
        teachers.set(key, teacher);
      }

      const scheduled = Number(row.scheduled);
      teacher.plannedHours += row.weeklyHours ?? 0;
      teacher.scheduledHours += scheduled;
      teacher.assignments.push({
        id: Number(row.assignmentId),
        classId: Number(row.classId),
        className: row.className,
        subjectId: Number(row.subjectId),
        subjectName: row.subjectName,
        weeklyHours: row.weeklyHours === null ? null : Number(row.weeklyHours),
        scheduled,
      });
    }

    for (const day of days) {
      const teacher = teachers.get(Number(day.teacherMembershipId));
      const index = Number(day.dayOfWeek) - 1;
      if (teacher && index >= 0 && index < 6) {
        teacher.byDay[index] = Number(day.lessons);
      }
    }

    return { date, teachers: [...teachers.values()] };
  }

  async create(dto: CreateLessonScheduleDto, user: AuthenticatedUser) {
    const endDate = dto.endDate ?? null;

    if (endDate !== null && endDate <= dto.startDate) {
      throw new BadRequestException(
        'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
      );
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(
        'Dars tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak',
      );
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Bir sinfga parallel dars qo‘shishni tartiblaymiz.
      const schoolClass = await manager.findOne(SchoolClass, {
        where: { id: dto.classId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!schoolClass) {
        throw new NotFoundException('Sinf topilmadi');
      }

      await this.checkSchoolAccess(schoolClass.schoolId, user, manager);

      this.checkAcademicYear(schoolClass.academicYear, dto.startDate, endDate);

      const assignment = await manager.findOneBy(TeacherClassSubject, {
        id: dto.teacherAssignmentId,
      });

      if (!assignment) {
        throw new NotFoundException('O‘qituvchi va fan biriktirmasi topilmadi');
      }

      if (assignment.classId !== schoolClass.id) {
        throw new BadRequestException(
          'O‘qituvchi biriktirmasi tanlangan sinfga tegishli emas',
        );
      }

      // Turli sinflarda bitta o‘qituvchi uchun
      // parallel jadval qo‘shishni ham tartiblaymiz.
      const membership = await manager.findOne(SchoolMembership, {
        where: { id: assignment.teacherMembershipId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !membership ||
        membership.type !== MembershipType.TEACHER ||
        membership.schoolId !== schoolClass.schoolId
      ) {
        throw new BadRequestException(
          'O‘qituvchining maktab biriktirmasi noto‘g‘ri',
        );
      }

      const within = (from: string, to: string | null) =>
        dto.startDate >= from &&
        (to === null ? true : endDate !== null && endDate <= to);

      if (
        !within(assignment.startDate, assignment.endDate) ||
        !within(membership.startDate, membership.endDate)
      ) {
        throw new BadRequestException(
          'Dars sanalari o‘qituvchining biriktirilgan davridan tashqarida',
        );
      }

      const repo = manager.getRepository(LessonSchedule);

      const overlap = await repo
        .createQueryBuilder('lesson')
        .innerJoin('lesson.teacherAssignment', 'existingAssignment')
        .where('lesson.isActive = :active', {
          active: true,
        })
        .andWhere('lesson.dayOfWeek = :day', {
          day: dto.dayOfWeek,
        })
        .andWhere(
          '(lesson.classId = :classId OR ' +
            'existingAssignment.teacherMembershipId = :teacherId)',
          {
            classId: dto.classId,
            teacherId: assignment.teacherMembershipId,
          },
        )
        .andWhere('lesson.startDate < :newEnd', {
          newEnd: endDate ?? '9999-12-31',
        })
        .andWhere('(lesson.endDate IS NULL OR lesson.endDate > :newStart)', {
          newStart: dto.startDate,
        })
        .andWhere('lesson.startTime < :newEndTime', {
          newEndTime: dto.endTime,
        })
        .andWhere('lesson.endTime > :newStartTime', {
          newStartTime: dto.startTime,
        })
        .getOne();

      if (overlap) {
        throw new ConflictException(
          'Bu vaqtda sinf yoki o‘qituvchida boshqa dars mavjud',
        );
      }

      const numberConflict = await repo
        .createQueryBuilder('lesson')
        .where('lesson.classId = :classId', {
          classId: dto.classId,
        })
        .andWhere('lesson.dayOfWeek = :day', {
          day: dto.dayOfWeek,
        })
        .andWhere('lesson.lessonNumber = :number', {
          number: dto.lessonNumber,
        })
        .andWhere('lesson.isActive = :active', {
          active: true,
        })
        .andWhere('lesson.startDate < :end', {
          end: endDate ?? '9999-12-31',
        })
        .andWhere('(lesson.endDate IS NULL OR lesson.endDate > :start)', {
          start: dto.startDate,
        })
        .getOne();

      if (numberConflict) {
        throw new ConflictException('Ushbu sinfda shu raqamli dars mavjud');
      }

      const lesson = repo.create({
        classId: dto.classId,
        teacherAssignmentId: dto.teacherAssignmentId,
        dayOfWeek: dto.dayOfWeek,
        lessonNumber: dto.lessonNumber,
        startTime: dto.startTime,
        endTime: dto.endTime,
        startDate: dto.startDate,
        endDate,
        isActive: true,
      });

      return repo.save(lesson);
    });
  }

  async findAll(dto: ListLessonSchedulesDto, user: AuthenticatedUser) {
    const schoolClass = await this.dataSource
      .getRepository(SchoolClass)
      .findOneBy({
        id: dto.classId,
        schoolId: dto.schoolId,
        academicYear: dto.academicYear,
      });

    if (!schoolClass) {
      throw new NotFoundException('Tanlangan o‘quv yilida sinf topilmadi');
    }

    await this.checkSchoolAccess(dto.schoolId, user, this.dataSource.manager);

    const repository = this.dataSource.getRepository(LessonSchedule);

    const query = repository
      .createQueryBuilder('lesson')
      .innerJoinAndSelect('lesson.teacherAssignment', 'assignment')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('membership.person', 'person')
      .where('lesson.classId = :classId', {
        classId: dto.classId,
      })
      .andWhere('lesson.isActive = :active', {
        active: true,
      });

    if (dto.date) {
      query
        .andWhere('lesson.startDate <= :date', {
          date: dto.date,
        })
        .andWhere('(lesson.endDate IS NULL OR lesson.endDate > :date)', {
          date: dto.date,
        });
    }

    const rows = await query
      .orderBy('lesson.dayOfWeek', 'ASC')
      .addOrderBy('lesson.lessonNumber', 'ASC')
      .addOrderBy('lesson.startTime', 'ASC')
      .getMany();

    return rows.map((lesson) => ({
      id: lesson.id,
      classId: lesson.classId,
      teacherAssignmentId: lesson.teacherAssignmentId,
      dayOfWeek: lesson.dayOfWeek,
      lessonNumber: lesson.lessonNumber,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      startDate: lesson.startDate,
      endDate: lesson.endDate,
      subject: {
        id: lesson.teacherAssignment.subject.id,
        nameUz: lesson.teacherAssignment.subject.nameUz,
      },
      teacher: {
        firstName: lesson.teacherAssignment.teacherMembership.person.firstName,
        lastName: lesson.teacherAssignment.teacherMembership.person.lastName,
        middleName:
          lesson.teacherAssignment.teacherMembership.person.middleName,
      },
    }));
  }

  async update(
    id: number,
    dto: UpdateLessonScheduleDto,
    user: AuthenticatedUser,
  ) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const repository = manager.getRepository(LessonSchedule);

      const existing = await repository.findOneBy({ id });

      if (!existing) {
        throw new NotFoundException('Dars jadvali topilmadi');
      }

      // Avval sinfni qulflaymiz.
      const schoolClass = await manager.findOne(SchoolClass, {
        where: { id: existing.classId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!schoolClass) {
        throw new NotFoundException('Sinf topilmadi');
      }

      await this.checkSchoolAccess(schoolClass.schoolId, user, manager);

      const assignment = await manager.findOneBy(TeacherClassSubject, {
        id: existing.teacherAssignmentId,
      });

      if (!assignment || assignment.classId !== schoolClass.id) {
        throw new BadRequestException(
          'Darsning o‘qituvchi biriktirmasi noto‘g‘ri',
        );
      }

      const membership = await manager.findOne(SchoolMembership, {
        where: { id: assignment.teacherMembershipId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !membership ||
        membership.type !== MembershipType.TEACHER ||
        membership.schoolId !== schoolClass.schoolId
      ) {
        throw new BadRequestException(
          'O‘qituvchining maktab biriktirmasi noto‘g‘ri',
        );
      }

      const lesson = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lesson) {
        throw new NotFoundException('Dars topilmadi');
      }

      if (!lesson.isActive) {
        throw new ConflictException(
          'Faolsizlantirilgan darsni o‘zgartirib bo‘lmaydi',
        );
      }

      const effectiveDate = dto.effectiveDate;

      // Versioning uchun eski davr kamida
      // bitta kunni qamrab olishi kerak.
      if (effectiveDate <= lesson.startDate) {
        throw new BadRequestException(
          'O‘zgarish sanasi eski dars boshlanishidan keyin bo‘lishi kerak',
        );
      }

      if (lesson.endDate !== null && effectiveDate >= lesson.endDate) {
        throw new BadRequestException(
          'O‘zgarish sanasi darsning amal qilish davridan tashqarida',
        );
      }

      const dayOfWeek = dto.dayOfWeek ?? lesson.dayOfWeek;

      const lessonNumber = dto.lessonNumber ?? lesson.lessonNumber;

      const startTime = dto.startTime ?? lesson.startTime.slice(0, 5);

      const endTime = dto.endTime ?? lesson.endTime.slice(0, 5);

      if (startTime >= endTime) {
        throw new BadRequestException(
          'Dars tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak',
        );
      }

      const originalEndDate = lesson.endDate;

      this.checkAcademicYear(
        schoolClass.academicYear,
        effectiveDate,
        originalEndDate,
      );

      // Yangi davr o‘qituvchi biriktirmasiga
      // va maktabdagi faoliyat davriga mos bo‘lsin.
      const within = (from: string, to: string | null) =>
        effectiveDate >= from &&
        (to === null || (originalEndDate !== null && originalEndDate <= to));

      if (
        !within(assignment.startDate, assignment.endDate) ||
        !within(membership.startDate, membership.endDate)
      ) {
        throw new BadRequestException(
          'Yangi dars sanalari o‘qituvchining biriktirilgan davridan tashqarida',
        );
      }

      // Boshqa sinf yoki o‘qituvchining
      // shu davrdagi darsiga to‘qnashmasin.
      const overlap = await repository
        .createQueryBuilder('other')
        .innerJoin('other.teacherAssignment', 'otherAssignment')
        .where('other.id != :id', { id })
        .andWhere('other.isActive = :active', {
          active: true,
        })
        .andWhere('other.dayOfWeek = :day', {
          day: dayOfWeek,
        })
        .andWhere(
          '(other.classId = :classId OR ' +
            'otherAssignment.teacherMembershipId = :teacherId)',
          {
            classId: schoolClass.id,
            teacherId: assignment.teacherMembershipId,
          },
        )
        .andWhere('other.startDate < :newEnd', {
          newEnd: originalEndDate ?? '9999-12-31',
        })
        .andWhere('(other.endDate IS NULL OR other.endDate > :newStart)', {
          newStart: effectiveDate,
        })
        .andWhere('other.startTime < :newEndTime', {
          newEndTime: endTime,
        })
        .andWhere('other.endTime > :newStartTime', {
          newStartTime: startTime,
        })
        .getOne();

      if (overlap) {
        throw new ConflictException(
          'Yangi davrda sinf yoki o‘qituvchining boshqa darsi mavjud',
        );
      }

      const numberConflict = await repository
        .createQueryBuilder('other')
        .where('other.id != :id', { id })
        .andWhere('other.classId = :classId', {
          classId: schoolClass.id,
        })
        .andWhere('other.dayOfWeek = :day', {
          day: dayOfWeek,
        })
        .andWhere('other.lessonNumber = :number', {
          number: lessonNumber,
        })
        .andWhere('other.isActive = :active', {
          active: true,
        })
        .andWhere('other.startDate < :newEnd', {
          newEnd: originalEndDate ?? '9999-12-31',
        })
        .andWhere('(other.endDate IS NULL OR other.endDate > :newStart)', {
          newStart: effectiveDate,
        })
        .getOne();

      if (numberConflict) {
        throw new ConflictException('Yangi davrda shu raqamli dars mavjud');
      }

      // 1. Eski versiya tarixda qoladi.
      lesson.endDate = effectiveDate;

      await repository.save(lesson);

      // 2. Yangi versiya alohida ID bilan yaratiladi.
      const newVersion = repository.create({
        classId: lesson.classId,
        teacherAssignmentId: lesson.teacherAssignmentId,
        dayOfWeek,
        lessonNumber,
        startTime,
        endTime,
        startDate: effectiveDate,
        endDate: originalEndDate,
        isActive: true,
      });

      const saved = await repository.save(newVersion);

      return {
        message: 'Dars jadvalining yangi versiyasi yaratildi',
        previousVersionId: lesson.id,
        newVersionId: saved.id,
        effectiveDate,
        previousVersionEndDate: lesson.endDate,
        newVersion: saved,
      };
    });
  }

  async remove(id: number, effectiveDate: string, user: AuthenticatedUser) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const repository = manager.getRepository(LessonSchedule);

      const existing = await repository.findOneBy({ id });

      if (!existing) {
        throw new NotFoundException('Dars topilmadi');
      }

      const schoolClass = await manager.findOne(SchoolClass, {
        where: { id: existing.classId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!schoolClass) {
        throw new NotFoundException('Sinf topilmadi');
      }

      await this.checkSchoolAccess(schoolClass.schoolId, user, manager);

      const assignment = await manager.findOneBy(TeacherClassSubject, {
        id: existing.teacherAssignmentId,
      });

      if (!assignment) {
        throw new NotFoundException('O‘qituvchi biriktirmasi topilmadi');
      }

      await manager.findOne(SchoolMembership, {
        where: { id: assignment.teacherMembershipId },
        lock: { mode: 'pessimistic_write' },
      });

      const lesson = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lesson) {
        throw new NotFoundException('Dars topilmadi');
      }

      if (!lesson.isActive) {
        throw new ConflictException('Dars allaqachon faolsizlantirilgan');
      }

      if (effectiveDate <= lesson.startDate) {
        throw new BadRequestException(
          'Bekor qilish sanasi dars boshlanishidan keyin bo‘lishi kerak',
        );
      }

      if (lesson.endDate !== null && effectiveDate >= lesson.endDate) {
        throw new BadRequestException(
          'Bekor qilish sanasi dars davridan tashqarida',
        );
      }

      // Eski davr saqlanadi.
      // effectiveDate dan boshlab bu jadval amal qilmaydi.
      lesson.endDate = effectiveDate;

      await repository.save(lesson);

      return {
        id: lesson.id,
        isActive: true,
        endDate: lesson.endDate,
        message: 'Dars belgilangan sanadan boshlab to‘xtatildi',
      };
    });
  }
}
