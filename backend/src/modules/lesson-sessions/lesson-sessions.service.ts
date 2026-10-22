import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';
import { LessonSchedule } from '../lesson-schedules/lesson-schedule.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import {
  TextbookTopic,
  TopicReviewStatus,
} from '../textbooks/textbook-topic.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { LessonSession, LessonSessionStatus } from './lesson-session.entity';
import { CreateLessonSessionDto } from './dto/create-lesson-session.dto';
import { ListLessonSessionsDto } from './dto/list-lesson-sessions.dto';
import { UpdateLessonSessionDto } from './dto/update-lesson-session.dto';

@Injectable()
export class LessonSessionsService {
  constructor(private readonly dataSource: DataSource) {}

  private async checkSchoolAccess(
    schoolId: number,
    user: AuthenticatedUser,
  ): Promise<void> {
    const school = await this.dataSource.getRepository(School).findOne({
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
        'Ushbu maktab elektron jurnaliga ruxsat yo‘q',
      );
    }
  }

  private dayOfWeek(date: string): number {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();

    // JavaScript: 0 = yakshanba.
    // Bizning jadval: 1 = dushanba, 6 = shanba.
    return day;
  }

  private validateScheduleDate(
    schedule: LessonSchedule,
    lessonDate: string,
  ): void {
    if (
      lessonDate < schedule.startDate ||
      (schedule.endDate !== null && lessonDate >= schedule.endDate)
    ) {
      throw new BadRequestException(
        'Tanlangan sana jadval versiyasining amal qilish davriga kirmaydi',
      );
    }

    const day = this.dayOfWeek(lessonDate);

    if (day === 0 || day !== schedule.dayOfWeek) {
      throw new BadRequestException(
        'Dars sanasi jadvaldagi hafta kuniga mos emas',
      );
    }
  }

  async create(dto: CreateLessonSessionDto, user: AuthenticatedUser) {
    const scheduleRepo = this.dataSource.getRepository(LessonSchedule);

    const schedule = await scheduleRepo.findOne({
      where: { id: dto.lessonScheduleId },
      relations: {
        schoolClass: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Dars jadvali topilmadi');
    }

    await this.checkSchoolAccess(schedule.schoolClass.schoolId, user);

    if (!schedule.isActive) {
      throw new ConflictException(
        'Faol bo‘lmagan jadval uchun dars yaratib bo‘lmaydi',
      );
    }

    this.validateScheduleDate(schedule, dto.lessonDate);

    const assignment = await this.dataSource
      .getRepository(TeacherClassSubject)
      .findOneBy({
        id: schedule.teacherAssignmentId,
      });

    if (!assignment || assignment.classId !== schedule.classId) {
      throw new BadRequestException(
        'Darsning o‘qituvchi biriktirmasi noto‘g‘ri',
      );
    }

    const classYear = schedule.schoolClass.academicYear;
    const years = /^(\d{4})-(\d{4})$/.exec(classYear);

    if (!years || Number(years[2]) !== Number(years[1]) + 1) {
      throw new BadRequestException('Sinfning o‘quv yili noto‘g‘ri');
    }

    if (
      dto.lessonDate < `${years[1]}-09-01` ||
      dto.lessonDate >= `${years[2]}-09-01`
    ) {
      throw new BadRequestException('Dars sanasi sinf o‘quv yiliga mos emas');
    }

    // Bitta jadval va sana uchun faqat
    // bitta LessonSession bo‘lishi mumkin.
    const repo = this.dataSource.getRepository(LessonSession);

    const existing = await repo.findOneBy({
      lessonScheduleId: schedule.id,
      lessonDate: dto.lessonDate,
    });

    if (existing) {
      throw new ConflictException(
        'Bu sana uchun dars sessiyasi allaqachon mavjud',
      );
    }

    const session = repo.create({
      lessonScheduleId: schedule.id,
      lessonDate: dto.lessonDate,
      classId: schedule.classId,
      teacherAssignmentId: schedule.teacherAssignmentId,
      lessonNumber: schedule.lessonNumber,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      textbookTopicId: null,
      topicTitle: null,
      homework: null,
      teacherNotes: null,
      status: LessonSessionStatus.PLANNED,
    });

    try {
      return await repo.save(session);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Bu sana uchun dars sessiyasi allaqachon yaratilgan',
          );
        }
      }

      throw error;
    }
  }

  async findAll(dto: ListLessonSessionsDto, user: AuthenticatedUser) {
    const schoolClass = await this.dataSource
      .getRepository(SchoolClass)
      .findOneBy({
        id: dto.classId,
        schoolId: dto.schoolId,
      });

    if (!schoolClass) {
      throw new NotFoundException('Sinf topilmadi');
    }

    await this.checkSchoolAccess(schoolClass.schoolId, user);

    const rows = await this.dataSource.getRepository(LessonSession).find({
      where: {
        classId: dto.classId,
        lessonDate: dto.date,
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
        lessonNumber: 'ASC',
        startTime: 'ASC',
        id: 'ASC',
      },
    });

    return rows.map((session) => ({
      id: session.id,
      lessonScheduleId: session.lessonScheduleId,
      lessonDate: session.lessonDate,
      classId: session.classId,
      lessonNumber: session.lessonNumber,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      textbookTopicId: session.textbookTopicId,
      topicTitle: session.topicTitle,
      homework: session.homework,
      teacherNotes: session.teacherNotes,
      subject: {
        id: session.teacherAssignment.subject.id,
        nameUz: session.teacherAssignment.subject.nameUz,
      },
      teacher: {
        firstName: session.teacherAssignment.teacherMembership.person.firstName,
        lastName: session.teacherAssignment.teacherMembership.person.lastName,
        middleName:
          session.teacherAssignment.teacherMembership.person.middleName,
      },
    }));
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const session = await this.dataSource.getRepository(LessonSession).findOne({
      where: { id },
      relations: {
        schoolClass: true,
        teacherAssignment: {
          subject: true,
          teacherMembership: {
            person: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Dars topilmadi');
    }

    await this.checkSchoolAccess(session.schoolClass.schoolId, user);

    return {
      id: session.id,
      lessonScheduleId: session.lessonScheduleId,
      lessonDate: session.lessonDate,
      classId: session.classId,
      teacherAssignmentId: session.teacherAssignmentId,
      lessonNumber: session.lessonNumber,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      textbookTopicId: session.textbookTopicId,
      topicTitle: session.topicTitle,
      homework: session.homework,
      teacherNotes: session.teacherNotes,
      subject: {
        id: session.teacherAssignment.subject.id,
        nameUz: session.teacherAssignment.subject.nameUz,
      },
      teacher: {
        firstName: session.teacherAssignment.teacherMembership.person.firstName,
        lastName: session.teacherAssignment.teacherMembership.person.lastName,
        middleName:
          session.teacherAssignment.teacherMembership.person.middleName,
      },
    };
  }

  async update(
    id: number,
    dto: UpdateLessonSessionDto,
    user: AuthenticatedUser,
  ) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('O‘zgartiriladigan ma’lumot yuborilmagan');
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const repo = manager.getRepository(LessonSession);

      const locked = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked) {
        throw new NotFoundException('Dars topilmadi');
      }

      const session = await repo.findOne({
        where: { id },
        relations: {
          schoolClass: true,
          teacherAssignment: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Dars topilmadi');
      }

      await this.checkSchoolAccess(session.schoolClass.schoolId, user);

      if (
        session.status === LessonSessionStatus.CANCELLED &&
        dto.status !== undefined &&
        dto.status !== LessonSessionStatus.CANCELLED
      ) {
        throw new ConflictException(
          'Bekor qilingan darsni qayta faollashtirish mumkin emas',
        );
      }

      if (dto.textbookTopicId !== undefined) {
        if (dto.textbookTopicId === null) {
          session.textbookTopicId = null;
          session.topicTitle = null;
        } else {
          const topic = await manager.getRepository(TextbookTopic).findOne({
            where: {
              id: dto.textbookTopicId,
              reviewStatus: TopicReviewStatus.APPROVED,
            },
            relations: { textbook: true },
          });

          if (!topic) {
            throw new NotFoundException(
              'Tasdiqlangan darslik mavzusi topilmadi',
            );
          }

          const subjectId = session.teacherAssignment.subjectId;

          if (topic.textbook.subjectId !== subjectId) {
            throw new BadRequestException(
              'Darslik mavzusi ushbu dars faniga tegishli emas',
            );
          }

          session.textbookTopicId = topic.id;
          session.topicTitle = topic.title;
        }
      }

      if (dto.topicTitle !== undefined) {
        session.topicTitle = dto.topicTitle?.trim() || null;
      }

      if (dto.homework !== undefined) {
        session.homework = dto.homework?.trim() || null;
      }

      if (dto.teacherNotes !== undefined) {
        session.teacherNotes = dto.teacherNotes?.trim() || null;
      }

      if (dto.status !== undefined) {
        session.status = dto.status;
      }

      return repo.save(session);
    });
  }
}
