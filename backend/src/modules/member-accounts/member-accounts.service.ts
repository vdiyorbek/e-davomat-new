import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { hashPassword } from '../../common/security/password';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';

import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';

import { UserPersonLink } from '../user-person-links/user-person-link.entity';

import { UserRole } from '../users/enums/user-role.enum';

import { User } from '../users/user.entity';

import { CreateMemberAccountDto } from './dto/create-member-account.dto';

@Injectable()
export class MemberAccountsService {
  constructor(private readonly dataSource: DataSource) {}

  private todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? '';

    return [get('year'), get('month'), get('day')].join('-');
  }

  private assertAdmin(actor: AuthenticatedUser): void {
    const roles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.REGION_ADMIN,
      UserRole.DISTRICT_ADMIN,
      UserRole.SCHOOL_ADMIN,
    ];

    if (!roles.includes(actor.role)) {
      throw new ForbiddenException('Akkaunt yaratishga vakolat yo‘q');
    }
  }

  private async authorizedMembership(
    manager: EntityManager,
    membershipId: number,
    actor: AuthenticatedUser,
  ): Promise<{
    membership: SchoolMembership;
    school: School;
  }> {
    this.assertAdmin(actor);

    const membership = await manager.findOne(SchoolMembership, {
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Maktab a’zoligi topilmadi');
    }

    const school = await manager.findOne(School, {
      where: { id: membership.schoolId },
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
      throw new NotFoundException('Maktab a’zoligi topilmadi');
    }

    const today = this.todayInTashkent();

    // endDate ushbu loyihada eksklyuziv sana:
    // shu kundan boshlab a'zolik tugagan hisoblanadi.
    if (
      membership.startDate > today ||
      (membership.endDate !== null && membership.endDate <= today)
    ) {
      throw new BadRequestException(
        'Faqat faol a’zolik uchun akkaunt ochish mumkin',
      );
    }

    return { membership, school };
  }

  async status(membershipId: number, actor: AuthenticatedUser) {
    const { membership } = await this.authorizedMembership(
      this.dataSource.manager,
      membershipId,
      actor,
    );

    const link = await this.dataSource.getRepository(UserPersonLink).findOneBy({
      personId: membership.personId,
    });

    if (!link) {
      return {
        membershipId,
        hasAccount: false,
        user: null,
      };
    }

    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: link.userId });

    if (!user) {
      throw new ConflictException(
        'Akkaunt bog‘lanishi mavjud, ammo foydalanuvchi topilmadi',
      );
    }

    return {
      membershipId,
      hasAccount: true,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async create(dto: CreateMemberAccountDto, actor: AuthenticatedUser) {
    // Vakolatni xeshlashdan oldin tekshiramiz.
    await this.authorizedMembership(
      this.dataSource.manager,
      dto.membershipId,
      actor,
    );

    // Parol oddiy matnda bazaga saqlanmaydi.
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          const { membership, school } = await this.authorizedMembership(
            manager,
            dto.membershipId,
            actor,
          );

          // Bir shaxsga parallel so‘rovlar kelganda
          // yaratishni ketma-ketlashtiramiz.
          const person = await manager.findOne(Person, {
            where: {
              id: membership.personId,
            },
            lock: {
              mode: 'pessimistic_write',
            },
          });

          if (!person || person.deletedAt !== null) {
            throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
          }

          // Qulf olingach ham a’zolikni qayta tekshiramiz.
          const currentMembership = await manager.findOneBy(SchoolMembership, {
            id: membership.id,
            personId: person.id,
            schoolId: school.id,
            type: membership.type,
          });

          const today = this.todayInTashkent();

          if (
            !currentMembership ||
            currentMembership.startDate > today ||
            (currentMembership.endDate !== null &&
              currentMembership.endDate <= today)
          ) {
            throw new ConflictException('Maktab a’zoligi o‘zgargan');
          }

          const existingLink = await manager.findOneBy(UserPersonLink, {
            personId: person.id,
          });

          if (existingLink) {
            throw new ConflictException(
              'Ushbu shaxs uchun akkaunt allaqachon mavjud',
            );
          }

          const existingLogin = await manager.findOneBy(User, {
            login: dto.login,
          });

          if (existingLogin) {
            throw new ConflictException('Ushbu login band');
          }

          const role =
            membership.type === MembershipType.TEACHER
              ? UserRole.TEACHER
              : membership.type === MembershipType.STUDENT
                ? UserRole.STUDENT
                : null;

          if (role === null) {
            throw new BadRequestException('Noma’lum a’zolik turi');
          }

          const user = manager.create(User, {
            login: dto.login,
            passwordHash,
            firstName: person.firstName,
            lastName: person.lastName,
            middleName: person.middleName,
            role,
            isActive: true,

            // Akkauntni boshlang‘ich maktab
            // bilan bog‘laymiz.
            regionId: null,
            districtId: null,
            schoolId: school.id,
          });

          const savedUser = await manager.save(User, user);

          const link = manager.create(UserPersonLink, {
            userId: savedUser.id,
            personId: person.id,
          });

          await manager.save(UserPersonLink, link);

          return {
            id: savedUser.id,
            login: savedUser.login,
            role: savedUser.role,
            isActive: savedUser.isActive,
            personId: person.id,
            membershipId: membership.id,
            schoolId: school.id,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            middleName: savedUser.middleName,
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
            'Login band yoki shaxs allaqachon akkauntga bog‘langan',
          );
        }
      }

      throw error;
    }
  }
}
