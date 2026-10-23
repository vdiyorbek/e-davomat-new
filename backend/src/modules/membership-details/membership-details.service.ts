import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { UserRole } from '../users/enums/user-role.enum';

import { School } from '../schools/school.entity';

import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';

import { StudentMembershipDetail } from './student-membership-detail.entity';

import { TeacherMembershipDetail } from './teacher-membership-detail.entity';

import { UpsertStudentDetailDto } from './dto/upsert-student-detail.dto';

import { UpsertTeacherDetailDto } from './dto/upsert-teacher-detail.dto';

@Injectable()
export class MembershipDetailsService {
  constructor(private readonly dataSource: DataSource) {}

  private async checkAccess(
    manager: EntityManager,
    membershipId: number,
    type: MembershipType,
    actor: AuthenticatedUser,
    lock = false,
  ): Promise<SchoolMembership> {
    const membership = await manager.findOne(SchoolMembership, {
      where: {
        id: membershipId,
        type,
      },
      ...(lock
        ? {
            lock: {
              mode: 'pessimistic_write' as const,
            },
          }
        : {}),
    });

    if (!membership) {
      throw new NotFoundException('Maktab a’zoligi topilmadi');
    }

    const school = await manager.findOne(School, {
      where: {
        id: membership.schoolId,
      },
      relations: {
        district: true,
      },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const allowed =
      actor.role === UserRole.SUPER_ADMIN ||
      (actor.role === UserRole.REGION_ADMIN &&
        actor.regionId != null &&
        actor.regionId === school.district.regionId) ||
      (actor.role === UserRole.DISTRICT_ADMIN &&
        actor.districtId != null &&
        actor.districtId === school.districtId) ||
      (actor.role === UserRole.SCHOOL_ADMIN &&
        actor.schoolId != null &&
        actor.schoolId === school.id);

    if (!allowed) {
      // Maktabga ruxsati bo'lmagan foydalanuvchiga
      // a'zolikning mavjudligini ham oshkor qilmaymiz.
      throw new NotFoundException('Maktab a’zoligi topilmadi');
    }

    return membership;
  }

  private normalize<T extends object>(dto: T): T {
    return Object.fromEntries(
      Object.entries(dto).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() || null : value,
      ]),
    ) as T;
  }

  private validatePayload(dto: object): void {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Kamida bitta maydon yuboring');
    }
  }

  // ==========================
  // STUDENT - GET
  // ==========================

  async getStudent(membershipId: number, actor: AuthenticatedUser) {
    await this.checkAccess(
      this.dataSource.manager,
      membershipId,
      MembershipType.STUDENT,
      actor,
    );

    const details = await this.dataSource
      .getRepository(StudentMembershipDetail)
      .findOneBy({
        membershipId,
      });

    return {
      membershipId,
      details,
    };
  }

  // ==========================
  // STUDENT - UPSERT
  // ==========================

  async upsertStudent(
    membershipId: number,
    dto: UpsertStudentDetailDto,
    actor: AuthenticatedUser,
  ) {
    this.validatePayload(dto);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await this.checkAccess(
        manager,
        membershipId,
        MembershipType.STUDENT,
        actor,
        true,
      );

      const repository = manager.getRepository(StudentMembershipDetail);

      let details = await repository.findOneBy({
        membershipId,
      });

      const values = this.normalize(dto);

      if (!details) {
        details = repository.create({
          membershipId,
          ...values,
        });
      } else {
        details = repository.merge(details, values);
      }

      const saved = await repository.save(details);

      return {
        membershipId,
        details: saved,
      };
    });
  }

  // ==========================
  // TEACHER - GET
  // ==========================

  async getTeacher(membershipId: number, actor: AuthenticatedUser) {
    await this.checkAccess(
      this.dataSource.manager,
      membershipId,
      MembershipType.TEACHER,
      actor,
    );

    const details = await this.dataSource
      .getRepository(TeacherMembershipDetail)
      .findOneBy({
        membershipId,
      });

    return {
      membershipId,
      details,
    };
  }

  // ==========================
  // TEACHER - UPSERT
  // ==========================

  async upsertTeacher(
    membershipId: number,
    dto: UpsertTeacherDetailDto,
    actor: AuthenticatedUser,
  ) {
    this.validatePayload(dto);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await this.checkAccess(
        manager,
        membershipId,
        MembershipType.TEACHER,
        actor,
        true,
      );

      const repository = manager.getRepository(TeacherMembershipDetail);

      let details = await repository.findOneBy({
        membershipId,
      });

      const values = this.normalize(dto);

      if (!details) {
        details = repository.create({
          membershipId,
          ...values,
        });
      } else {
        details = repository.merge(details, values);
      }

      const saved = await repository.save(details);

      return {
        membershipId,
        details: saved,
      };
    });
  }
}
