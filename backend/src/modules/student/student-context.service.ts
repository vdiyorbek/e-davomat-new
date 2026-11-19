import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { MembershipType } from '../school-memberships/school-membership.entity';
import {
  TeacherContextService,
  todayInTashkent,
} from '../teacher/teacher-context.service';
import { UserRole } from '../users/enums/user-role.enum';

export interface StudentContext {
  personId: number;
  pnfl: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  schoolId: number;
  schoolName: string;
  classId: number;
  className: string;
  gradeLevel: number | null;
  academicYear: string;
}

/** O‘quvchi akkaunti → shaxs → bugungi faol sinfi. */
@Injectable()
export class StudentContextService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly people: TeacherContextService,
  ) {}

  async current(user: AuthenticatedUser): Promise<StudentContext> {
    const personId = await this.people.personId(user, UserRole.STUDENT);
    const today = todayInTashkent();

    const [row]: (StudentContext & { personId: string })[] =
      await this.dataSource.query(
        `SELECT p.id AS personId, p.pnfl, p.firstName, p.lastName, p.middleName,
              s.id AS schoolId, s.name AS schoolName,
              c.id AS classId, c.name AS className, c.gradeLevel, c.academicYear
         FROM school_memberships m
         JOIN persons p ON p.id = m.personId
         JOIN schools s ON s.id = m.schoolId
         JOIN school_classes c ON c.id = m.classId
        WHERE m.personId = ? AND m.type = ? AND m.classId IS NOT NULL
          AND m.startDate <= ? AND (m.endDate IS NULL OR m.endDate > ?)
        ORDER BY m.startDate DESC
        LIMIT 1`,
        [personId, MembershipType.STUDENT, today, today],
      );

    if (!row) {
      throw new ForbiddenException('Sizda faol sinf a’zoligi topilmadi');
    }

    return {
      ...row,
      personId: Number(row.personId),
      schoolId: Number(row.schoolId),
      classId: Number(row.classId),
      gradeLevel: row.gradeLevel === null ? null : Number(row.gradeLevel),
    };
  }
}
