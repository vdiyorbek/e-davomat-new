import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { UserRole } from '../users/enums/user-role.enum';
import { UserPersonLink } from '../user-person-links/user-person-link.entity';

import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';

import { MembershipType } from '../school-memberships/school-membership.entity';

@Injectable()
export class TeacherService {
  constructor(private readonly dataSource: DataSource) {}

  private todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return [get('year'), get('month'), get('day')].join('-');
  }

  async myAssignments(user: AuthenticatedUser) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Ushbu API faqat o‘qituvchilar uchun');
    }

    const link = await this.dataSource.getRepository(UserPersonLink).findOne({
      where: { userId: user.id },
      relations: { person: true },
    });

    if (!link || link.person.deletedAt !== null) {
      throw new UnauthorizedException('Akkaunt shaxsga bog‘lanmagan');
    }

    const today = this.todayInTashkent();

    const assignments = await this.dataSource
      .getRepository(TeacherClassSubject)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .innerJoinAndSelect('membership.school', 'school')
      .where('membership.personId = :personId', {
        personId: link.personId,
      })
      .andWhere('membership.type = :type', {
        type: MembershipType.TEACHER,
      })
      .andWhere('membership.startDate <= :today', {
        today,
      })
      .andWhere(
        '(membership.endDate IS NULL OR membership.endDate >= :today)',
        { today },
      )
      .andWhere('assignment.startDate <= :today', {
        today,
      })
      .andWhere('(assignment.endDate IS NULL OR assignment.endDate > :today)', {
        today,
      })
      .andWhere('schoolClass.schoolId = membership.schoolId')
      .orderBy('school.name', 'ASC')
      .addOrderBy('schoolClass.name', 'ASC')
      .addOrderBy('subject.nameUz', 'ASC')
      .getMany();

    return assignments.map((assignment) => ({
      id: assignment.id,
      teacherMembershipId: assignment.teacherMembershipId,

      school: {
        id: assignment.teacherMembership.school.id,
        name: assignment.teacherMembership.school.name,
      },

      class: {
        id: assignment.schoolClass.id,
        name: assignment.schoolClass.name,
        academicYear: assignment.schoolClass.academicYear,
        gradeLevel: assignment.schoolClass.gradeLevel,
      },

      subject: {
        id: assignment.subject.id,
        nameUz: assignment.subject.nameUz,
      },

      startDate: assignment.startDate,
      endDate: assignment.endDate,
    }));
  }
}
