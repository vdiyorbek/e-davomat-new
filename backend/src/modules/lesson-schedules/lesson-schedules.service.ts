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

import { LessonSchedule } from './lesson-schedule.entity';
import { CreateLessonScheduleDto } from './dto/create-lesson-schedule.dto';
import { ListLessonSchedulesDto } from './dto/list-lesson-schedules.dto';

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

    const rows = await this.dataSource.getRepository(LessonSchedule).find({
      where: {
        classId: dto.classId,
        isActive: true,
      },
      relations: {
        teacherAssignment: {
          subject: true,
          teacherMembership: {
            person: true,
          },
        },
      },
      order: {
        dayOfWeek: 'ASC',
        lessonNumber: 'ASC',
        startTime: 'ASC',
      },
    });

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
}
