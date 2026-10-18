import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { School } from '../schools/school.entity';
import { SchoolClass } from '../classes/school-class.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { Subject } from '../subjects/subject.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { TeacherClassSubject } from './teacher-class-subject.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { ListTeacherAssignmentsDto } from './dto/list-teacher-assignments.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly dataSource: DataSource) {}

  private async checkSchoolAccess(
    schoolId: number,
    user: AuthenticatedUser,
    manager: EntityManager,
  ): Promise<School> {
    const school = await manager.getRepository(School).findOne({
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
        'Ushbu maktab o‘qituvchilarini boshqarishga ruxsat yo‘q',
      );
    }

    return school;
  }

  private getAcademicYearBounds(academicYear: string) {
    const match = /^(\d{4})-(\d{4})$/.exec(academicYear);

    if (!match) {
      throw new BadRequestException('O‘quv yili noto‘g‘ri');
    }

    const from = Number(match[1]);
    const to = Number(match[2]);

    if (to !== from + 1 || from < 2000 || to > 2100) {
      throw new BadRequestException(
        'O‘quv yili 2026-2027 formatida bo‘lishi kerak',
      );
    }

    return {
      start: `${from}-09-01`,
      endExclusive: `${to}-09-01`,
    };
  }

  async create(dto: CreateTeacherAssignmentDto, user: AuthenticatedUser) {
    const endDate = dto.endDate ?? null;

    if (endDate !== null && endDate <= dto.startDate) {
      throw new BadRequestException(
        'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
      );
    }

    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          // Bitta o‘qituvchi uchun parallel biriktirishlarni
          // ketma-ket amalga oshiramiz.
          const membership = await manager.findOne(SchoolMembership, {
            where: { id: dto.teacherMembershipId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!membership) {
            throw new NotFoundException(
              'O‘qituvchining maktabga biriktirilishi topilmadi',
            );
          }

          await this.checkSchoolAccess(membership.schoolId, user, manager);

          if (membership.type !== MembershipType.TEACHER) {
            throw new BadRequestException(
              'Tanlangan shaxs TEACHER maqomida emas',
            );
          }

          const schoolClass = await manager.findOneBy(SchoolClass, {
            id: dto.classId,
            schoolId: membership.schoolId,
          });

          if (!schoolClass) {
            throw new BadRequestException(
              'Sinf o‘qituvchining maktabiga tegishli emas',
            );
          }

          const subject = await manager.findOneBy(Subject, {
            id: dto.subjectId,
            isActive: true,
          });

          if (!subject) {
            throw new NotFoundException('Fan topilmadi yoki faol emas');
          }

          const bounds = this.getAcademicYearBounds(schoolClass.academicYear);

          if (
            dto.startDate < bounds.start ||
            dto.startDate >= bounds.endExclusive ||
            (endDate !== null && endDate > bounds.endExclusive)
          ) {
            throw new BadRequestException(
              'Biriktirish sanalari sinfning o‘quv yiliga mos emas',
            );
          }

          if (
            dto.startDate < membership.startDate ||
            (membership.endDate !== null &&
              (dto.startDate >= membership.endDate ||
                endDate === null ||
                endDate > membership.endDate))
          ) {
            throw new BadRequestException(
              'Biriktirish sanalari o‘qituvchining maktabdagi faoliyat davridan tashqarida',
            );
          }

          const repository = manager.getRepository(TeacherClassSubject);

          // Sana oraliqlari [startDate, endDate).
          const overlapping = await repository
            .createQueryBuilder('assignment')
            .where('assignment.teacherMembershipId = :teacherMembershipId', {
              teacherMembershipId: dto.teacherMembershipId,
            })
            .andWhere('assignment.classId = :classId', {
              classId: dto.classId,
            })
            .andWhere('assignment.subjectId = :subjectId', {
              subjectId: dto.subjectId,
            })
            .andWhere('assignment.startDate < :newEnd', {
              newEnd: endDate ?? '9999-12-31',
            })
            .andWhere(
              '(assignment.endDate IS NULL OR assignment.endDate > :newStart)',
              { newStart: dto.startDate },
            )
            .getOne();

          if (overlapping) {
            throw new ConflictException(
              'O‘qituvchi ushbu fan va sinfga shu davrda allaqachon biriktirilgan',
            );
          }

          const assignment = repository.create({
            teacherMembershipId: membership.id,
            classId: schoolClass.id,
            subjectId: subject.id,
            startDate: dto.startDate,
            endDate,
          });

          return repository.save(assignment);
        },
      );
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException('Bunday biriktirish mavjud');
        }
      }

      throw error;
    }
  }

  async findAll(dto: ListTeacherAssignmentsDto, user: AuthenticatedUser) {
    this.getAcademicYearBounds(dto.academicYear);

    await this.checkSchoolAccess(dto.schoolId, user, this.dataSource.manager);

    const builder = this.dataSource
      .getRepository(TeacherClassSubject)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('membership.person', 'teacher')
      .innerJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .where('schoolClass.schoolId = :schoolId', {
        schoolId: dto.schoolId,
      })
      .andWhere('membership.schoolId = :schoolId', {
        schoolId: dto.schoolId,
      })
      .andWhere('membership.type = :membershipType', {
        membershipType: MembershipType.TEACHER,
      })
      .andWhere('schoolClass.academicYear = :academicYear', {
        academicYear: dto.academicYear,
      });

    if (dto.teacherMembershipId !== undefined) {
      builder.andWhere(
        'assignment.teacherMembershipId = :teacherMembershipId',
        {
          teacherMembershipId: dto.teacherMembershipId,
        },
      );
    }

    if (dto.classId !== undefined) {
      builder.andWhere('assignment.classId = :classId', {
        classId: dto.classId,
      });
    }

    if (dto.subjectId !== undefined) {
      builder.andWhere('assignment.subjectId = :subjectId', {
        subjectId: dto.subjectId,
      });
    }

    const rows = await builder
      .orderBy('schoolClass.name', 'ASC')
      .addOrderBy('subject.nameUz', 'ASC')
      .addOrderBy('teacher.lastName', 'ASC')
      .addOrderBy('assignment.id', 'ASC')
      .getMany();

    // API javobida ortiqcha shaxsiy ma’lumotlarni
    // (PNFL, manzil va boshqalar) qaytarmaymiz.
    return rows.map((item) => ({
      id: item.id,
      teacherMembershipId: item.teacherMembershipId,
      teacher: {
        personId: item.teacherMembership.personId,
        firstName: item.teacherMembership.person.firstName,
        lastName: item.teacherMembership.person.lastName,
        middleName: item.teacherMembership.person.middleName,
      },
      class: {
        id: item.schoolClass.id,
        name: item.schoolClass.name,
        gradeLevel: item.schoolClass.gradeLevel,
      },
      subject: {
        id: item.subject.id,
        code: item.subject.code,
        nameUz: item.subject.nameUz,
      },
      startDate: item.startDate,
      endDate: item.endDate,
    }));
  }
}
