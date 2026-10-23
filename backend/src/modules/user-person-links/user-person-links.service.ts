import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { User } from '../users/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';

import { UserPersonLink } from './user-person-link.entity';
import { CreateUserPersonLinkDto } from './dto/create-user-person-link.dto';

@Injectable()
export class UserPersonLinksService {
  constructor(private readonly dataSource: DataSource) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private async assertSchoolAccess(
    schoolId: number,
    actor: AuthenticatedUser,
  ): Promise<School> {
    const school = await this.dataSource.getRepository(School).findOne({
      where: { id: schoolId },
      relations: { district: true },
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
      throw new ForbiddenException('Ushbu maktab uchun vakolat yo‘q');
    }

    return school;
  }

  async create(dto: CreateUserPersonLinkDto, actor: AuthenticatedUser) {
    const membership = await this.dataSource
      .getRepository(SchoolMembership)
      .findOneBy({
        id: dto.membershipId,
        personId: dto.personId,
      });

    if (!membership) {
      throw new NotFoundException('Shaxsning maktab a’zoligi topilmadi');
    }

    const school = await this.assertSchoolAccess(membership.schoolId, actor);

    const today = this.today();

    if (
      membership.startDate > today ||
      (membership.endDate !== null && membership.endDate < today)
    ) {
      throw new BadRequestException(
        'Faqat amaldagi a’zolik bilan bog‘lash mumkin',
      );
    }

    const targetRole =
      membership.type === MembershipType.TEACHER
        ? UserRole.TEACHER
        : membership.type === MembershipType.STUDENT
          ? UserRole.STUDENT
          : null;

    if (!targetRole) {
      throw new BadRequestException('A’zolik turi mos emas');
    }

    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          const user = await manager.findOne(User, {
            where: { id: dto.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!user) {
            throw new NotFoundException('Akkaunt topilmadi');
          }

          if (!user.isActive) {
            throw new BadRequestException('Akkaunt faol emas');
          }

          if (user.role !== UserRole.USER && user.role !== targetRole) {
            throw new ForbiddenException(
              'Ushbu akkauntning rolini bog‘lash orqali o‘zgartirib bo‘lmaydi',
            );
          }

          // Oddiy akkauntga avvaldan biriktirilgan
          // hududiy cheklovlar ham saqlanadi.
          if (
            (user.schoolId != null && user.schoolId !== school.id) ||
            (user.districtId != null &&
              user.districtId !== school.districtId) ||
            (user.regionId != null &&
              user.regionId !== school.district.regionId)
          ) {
            throw new ForbiddenException('Akkaunt hududi maktabga mos emas');
          }

          const person = await manager.findOneBy(Person, {
            id: dto.personId,
          });

          if (!person) {
            throw new NotFoundException('Shaxs topilmadi');
          }

          const existingUser = await manager.findOneBy(UserPersonLink, {
            userId: dto.userId,
          });

          if (existingUser) {
            throw new ConflictException('Akkaunt allaqachon bog‘langan');
          }

          const existingPerson = await manager.findOneBy(UserPersonLink, {
            personId: dto.personId,
          });

          if (existingPerson) {
            throw new ConflictException('Shaxs boshqa akkauntga bog‘langan');
          }

          // A’zolik oldindan tekshirilgan bo‘lsa ham,
          // tranzaksiya davomida qayta tekshiramiz.
          const currentMembership = await manager.findOneBy(SchoolMembership, {
            id: dto.membershipId,
            personId: dto.personId,
            schoolId: school.id,
            type: membership.type,
          });

          if (
            !currentMembership ||
            currentMembership.startDate > today ||
            (currentMembership.endDate !== null &&
              currentMembership.endDate < today)
          ) {
            throw new ConflictException('Maktab a’zoligi o‘zgargan');
          }

          const link = await manager.save(
            UserPersonLink,
            manager.create(UserPersonLink, {
              userId: user.id,
              personId: person.id,
            }),
          );

          user.role = targetRole;
          await manager.save(User, user);

          return {
            id: link.id,
            userId: user.id,
            personId: person.id,
            membershipId: currentMembership.id,
            schoolId: school.id,
            role: user.role,
            person: {
              firstName: person.firstName,
              lastName: person.lastName,
              middleName: person.middleName,
            },
          };
        },
      );
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Akkaunt yoki shaxs allaqachon bog‘langan',
          );
        }
      }

      throw error;
    }
  }

  async findByUser(userId: number, actor: AuthenticatedUser) {
    const link = await this.dataSource.getRepository(UserPersonLink).findOne({
      where: { userId },
      relations: { user: true },
    });

    if (!link) {
      throw new NotFoundException('Bog‘lanish topilmadi');
    }

    const person = await this.dataSource
      .getRepository(Person)
      .findOneBy({ id: link.personId });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi');
    }

    const memberships = await this.dataSource
      .getRepository(SchoolMembership)
      .find({
        where: { personId: person.id },
      });

    const today = this.today();
    let allowedMembership: SchoolMembership | null = null;

    for (const membership of memberships) {
      if (
        membership.startDate > today ||
        (membership.endDate !== null && membership.endDate < today)
      ) {
        continue;
      }

      try {
        await this.assertSchoolAccess(membership.schoolId, actor);
        allowedMembership = membership;
        break;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) {
          throw error;
        }
      }
    }

    if (!allowedMembership) {
      throw new ForbiddenException('Ushbu bog‘lanishga ruxsat yo‘q');
    }

    return {
      id: link.id,
      userId: link.userId,
      personId: link.personId,
      role: link.user.role,
      membershipId: allowedMembership.id,
      schoolId: allowedMembership.schoolId,
      person: {
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
      },
    };
  }
}
