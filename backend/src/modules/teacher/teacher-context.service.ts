import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { MembershipType } from '../school-memberships/school-membership.entity';
import { TeacherClassSubject } from '../teacher-assignments/teacher-class-subject.entity';
import { UserPersonLink } from '../user-person-links/user-person-link.entity';
import { UserRole } from '../users/enums/user-role.enum';

export function todayInTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
    new Date(),
  );
}

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

/** Xom SQL'dagi DATE qiymati (mysql2 'Z' rejimida UTC yarim tun) → YYYY-MM-DD. */
export function sqlDate(value: string | Date): string {
  return typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Akkaunt → shaxs → faol o‘qituvchi biriktirmalari. Kabinet va testlar uchun umumiy. */
@Injectable()
export class TeacherContextService {
  constructor(private readonly dataSource: DataSource) {}

  async personId(user: AuthenticatedUser, role: UserRole): Promise<number> {
    if (user.role !== role) {
      throw new ForbiddenException('Ushbu bo‘lim sizning rolingiz uchun emas');
    }

    const link = await this.dataSource.getRepository(UserPersonLink).findOne({
      where: { userId: user.id },
      relations: { person: true },
    });

    if (!link || link.person.deletedAt !== null) {
      throw new UnauthorizedException('Akkaunt shaxsga bog‘lanmagan');
    }

    return link.personId;
  }

  /** O‘qituvchining berilgan sanada faol fan-sinf biriktirmalari. */
  async activeAssignments(
    personId: number,
    date = todayInTashkent(),
  ): Promise<TeacherClassSubject[]> {
    return this.dataSource
      .getRepository(TeacherClassSubject)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.teacherMembership', 'membership')
      .innerJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .innerJoinAndSelect('assignment.subject', 'subject')
      .innerJoinAndSelect('membership.school', 'school')
      .where('membership.personId = :personId', { personId })
      .andWhere('membership.type = :type', { type: MembershipType.TEACHER })
      .andWhere('membership.startDate <= :date', { date })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :date)', {
        date,
      })
      .andWhere('assignment.startDate <= :date', { date })
      .andWhere('(assignment.endDate IS NULL OR assignment.endDate > :date)', {
        date,
      })
      .andWhere('schoolClass.schoolId = membership.schoolId')
      .orderBy('schoolClass.name', 'ASC')
      .addOrderBy('subject.nameUz', 'ASC')
      .getMany();
  }

  /** Biriktirma shu o‘qituvchiniki va bugun faolmi. */
  async ownAssignment(
    user: AuthenticatedUser,
    assignmentId: number,
  ): Promise<TeacherClassSubject> {
    const personId = await this.personId(user, UserRole.TEACHER);
    const assignment = (await this.activeAssignments(personId)).find(
      (item) => item.id === assignmentId,
    );

    if (!assignment) {
      throw new NotFoundException(
        'Fan va sinf biriktirmasi topilmadi yoki sizga tegishli emas',
      );
    }

    if (assignment.schoolClass.gradeLevel == null) {
      throw new BadRequestException('Sinf darajasi belgilanmagan');
    }

    return assignment;
  }
}
