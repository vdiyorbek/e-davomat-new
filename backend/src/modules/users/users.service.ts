import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Brackets, DataSource, QueryFailedError } from 'typeorm';
import { hashPassword } from 'src/common/security/password';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UserRole } from './enums/user-role.enum';
import { User } from './user.entity';
import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { AuthSession } from '../auth/auth-session.entity';
import { SelectQueryBuilder } from 'typeorm/browser';

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateUserDto, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.USER) {
      throw new ForbiddenException('Foydalanuvchi yaratishga ruxsat yo‘q');
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const middleName = dto.middleName?.trim() || null;

    if (
      firstName.length < 2 ||
      lastName.length < 2 ||
      firstName.length > 100 ||
      lastName.length > 100
    ) {
      throw new BadRequestException('Ism va familiyani to‘g‘ri kiriting');
    }

    // Administrator yaratgan oddiy USER ham uning
    // boshqaruv hududiga biriktiriladi.
    const scope = {
      regionId: null as number | null,
      districtId: null as number | null,
      schoolId: null as number | null,
    };

    switch (currentUser.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!currentUser.regionId) {
          throw new ForbiddenException(
            'Administratorga viloyat biriktirilmagan',
          );
        }
        scope.regionId = currentUser.regionId;
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!currentUser.districtId) {
          throw new ForbiddenException('Administratorga tuman biriktirilmagan');
        }
        scope.districtId = currentUser.districtId;
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!currentUser.schoolId) {
          throw new ForbiddenException(
            'Administratorga maktab biriktirilmagan',
          );
        }
        scope.schoolId = currentUser.schoolId;
        break;

      default:
        throw new ForbiddenException('Foydalanuvchi yaratishga ruxsat yo‘q');
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOneBy(User, {
          login: dto.login,
        });

        if (existing) {
          throw new ConflictException('Ushbu login band');
        }

        const user = manager.create(User, {
          firstName,
          lastName,
          middleName,
          login: dto.login,
          passwordHash,
          role: UserRole.USER,
          isActive: true,
          ...scope,
        });

        const saved = await manager.save(User, user);

        return {
          id: saved.id,
          firstName: saved.firstName,
          lastName: saved.lastName,
          middleName: saved.middleName,
          login: saved.login,
          role: saved.role,
          isActive: saved.isActive,
          scope: {
            regionId: saved.regionId,
            districtId: saved.districtId,
            schoolId: saved.schoolId,
          },
          createdAt: saved.createdAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException('Ushbu login band');
        }
      }

      throw error;
    }
  }

  async updateAccess(
    id: number,
    dto: UpdateUserAccessDto,
    currentUser: AuthenticatedUser,
  ) {
    const ranks: Record<UserRole, number> = {
      [UserRole.USER]: 0,
      [UserRole.SCHOOL_ADMIN]: 1,
      [UserRole.DISTRICT_ADMIN]: 2,
      [UserRole.REGION_ADMIN]: 3,
      [UserRole.SUPER_ADMIN]: 4,
    };

    if (ranks[currentUser.role] < 2) {
      throw new ForbiddenException('Vakolatlarni o‘zgartirishga ruxsat yo‘q');
    }

    if (id === currentUser.id || ranks[dto.role] >= ranks[currentUser.role]) {
      throw new ForbiddenException('Ushbu vakolatni berishga ruxsat yo‘q');
    }

    const regionId = dto.regionId ?? null;
    const districtId = dto.districtId ?? null;
    const schoolId = dto.schoolId ?? null;

    const selectedCount =
      Number(regionId !== null) +
      Number(districtId !== null) +
      Number(schoolId !== null);

    const validScope =
      (dto.role === UserRole.USER && selectedCount <= 1) ||
      (dto.role === UserRole.REGION_ADMIN &&
        regionId !== null &&
        selectedCount === 1) ||
      (dto.role === UserRole.DISTRICT_ADMIN &&
        districtId !== null &&
        selectedCount === 1) ||
      (dto.role === UserRole.SCHOOL_ADMIN &&
        schoolId !== null &&
        selectedCount === 1);

    if (!validScope) {
      throw new BadRequestException('Rolga mos hududni tanlang');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Foydalanuvchi topilmadi');
      }

      if (!user.isActive || ranks[user.role] >= ranks[currentUser.role]) {
        throw new ForbiddenException(
          'Ushbu akkaunt vakolatini o‘zgartira olmaysiz',
        );
      }

      // Hududlarni haqiqiy maktab va tuman orqali aniqlaymiz.
      async function resolveScope(
        rId: number | null,
        dId: number | null,
        sId: number | null,
      ) {
        if (sId !== null) {
          const school = await manager.findOne(School, {
            where: { id: sId },
            relations: { district: true },
          });

          if (!school) {
            throw new NotFoundException('Maktab topilmadi');
          }

          return {
            regionId: school.district.regionId,
            districtId: school.districtId,
          };
        }

        if (dId !== null) {
          const district = await manager.findOneBy(District, {
            id: dId,
          });

          if (!district) {
            throw new NotFoundException('Tuman topilmadi');
          }

          return {
            regionId: district.regionId,
            districtId: district.id,
          };
        }

        if (rId !== null) {
          const region = await manager.findOneBy(Region, {
            id: rId,
          });

          if (!region) {
            throw new NotFoundException('Viloyat topilmadi');
          }

          return {
            regionId: region.id,
            districtId: null,
          };
        }

        return {
          regionId: null,
          districtId: null,
        };
      }

      const previous = await resolveScope(
        user.regionId,
        user.districtId,
        user.schoolId,
      );

      const next = await resolveScope(regionId, districtId, schoolId);

      if (currentUser.role === UserRole.REGION_ADMIN) {
        if (
          !currentUser.regionId ||
          previous.regionId !== currentUser.regionId ||
          next.regionId !== currentUser.regionId
        ) {
          throw new ForbiddenException(
            'Faqat o‘z viloyatingizdagi hisobni boshqarasiz',
          );
        }
      }

      if (currentUser.role === UserRole.DISTRICT_ADMIN) {
        if (
          !currentUser.districtId ||
          previous.districtId !== currentUser.districtId ||
          next.districtId !== currentUser.districtId
        ) {
          throw new ForbiddenException(
            'Faqat o‘z tumaningizdagi hisobni boshqarasiz',
          );
        }
      }

      const changed =
        user.role !== dto.role ||
        user.regionId !== regionId ||
        user.districtId !== districtId ||
        user.schoolId !== schoolId;

      if (changed) {
        user.role = dto.role;
        user.regionId = regionId;
        user.districtId = districtId;
        user.schoolId = schoolId;

        await manager.save(User, user);

        // Vakolat o‘zgarganida eski sessiyalar bekor qilinadi.
        await manager
          .createQueryBuilder()
          .update(AuthSession)
          .set({ revokedAt: new Date() })
          .where('userId = :userId', {
            userId: user.id,
          })
          .andWhere('revokedAt IS NULL')
          .execute();
      }

      return {
        id: user.id,
        login: user.login,
        role: user.role,
        regionId: user.regionId,
        districtId: user.districtId,
        schoolId: user.schoolId,
        message: changed ? 'Vakolat yangilandi' : 'Vakolat o‘zgarmagan',
      };
    });
  }

  private applyReadScope(
    query: SelectQueryBuilder<User>,
    currentUser: AuthenticatedUser,
  ): void {
    switch (currentUser.role) {
      case UserRole.SUPER_ADMIN:
        return;

      case UserRole.REGION_ADMIN:
        if (!currentUser.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        query.andWhere(
          new Brackets((qb) => {
            qb.where('user.regionId = :scopeRegionId')
              .orWhere('district.regionId = :scopeRegionId')
              .orWhere('schoolDistrict.regionId = :scopeRegionId');
          }),
          { scopeRegionId: currentUser.regionId },
        );
        return;

      case UserRole.DISTRICT_ADMIN:
        if (!currentUser.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        query.andWhere(
          new Brackets((qb) => {
            qb.where('user.districtId = :scopeDistrictId').orWhere(
              'school.districtId = :scopeDistrictId',
            );
          }),
          { scopeDistrictId: currentUser.districtId },
        );
        return;

      case UserRole.SCHOOL_ADMIN:
        if (!currentUser.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        query.andWhere('user.schoolId = :scopeSchoolId', {
          scopeSchoolId: currentUser.schoolId,
        });
        return;

      default:
        throw new ForbiddenException(
          'Foydalanuvchilarni ko‘rishga ruxsat yo‘q',
        );
    }
  }

  async findAll(filters: GetUsersQueryDto, currentUser: AuthenticatedUser) {
    const {
      page,
      limit,
      search,
      role,
      isActive,
      regionId,
      districtId,
      schoolId,
    } = filters;

    const query = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.district', 'district')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('district.region', 'districtRegion')
      .leftJoinAndSelect('school.district', 'schoolDistrict')
      .leftJoinAndSelect('schoolDistrict.region', 'schoolRegion');

    this.applyReadScope(query, currentUser);

    if (regionId !== undefined) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.regionId = :filterRegionId')
            .orWhere('district.regionId = :filterRegionId')
            .orWhere('schoolDistrict.regionId = :filterRegionId');
        }),
        { filterRegionId: regionId },
      );
    }

    if (districtId !== undefined) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.districtId = :filterDistrictId').orWhere(
            'school.districtId = :filterDistrictId',
          );
        }),
        { filterDistrictId: districtId },
      );
    }

    if (schoolId !== undefined) {
      query.andWhere('user.schoolId = :filterSchoolId', {
        filterSchoolId: schoolId,
      });
    }

    if (role !== undefined) {
      query.andWhere('user.role = :filterRole', {
        filterRole: role,
      });
    }

    if (isActive !== undefined) {
      query.andWhere('user.isActive = :filterActive', {
        filterActive: isActive,
      });
    }

    if (search) {
      const words = search.split(/\s+/).filter(Boolean);

      words.forEach((word, index) => {
        const escaped = word.replace(/[!%_]/g, '!$&');
        const param = `searchWord${index}`;

        query.andWhere(
          new Brackets((qb) => {
            qb.where(`user.login LIKE :${param} ESCAPE '!'`)
              .orWhere(`user.firstName LIKE :${param} ESCAPE '!'`)
              .orWhere(`user.lastName LIKE :${param} ESCAPE '!'`)
              .orWhere(`user.middleName LIKE :${param} ESCAPE '!'`);
          }),
          { [param]: `%${escaped}%` },
        );
      });
    }

    const total = await query.getCount();

    const users = await query
      .orderBy('user.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: users.map((user) => {
        const resolvedRegion =
          user.region ??
          user.district?.region ??
          user.school?.district?.region ??
          null;

        const resolvedDistrict = user.district ?? user.school?.district ?? null;

        return {
          id: user.id,
          login: user.login,
          fullName: [user.lastName, user.firstName, user.middleName]
            .filter(Boolean)
            .join(' '),
          role: user.role,
          isActive: user.isActive,
          photoUrl: user.photoUrl,
          // Bevosita biriktirilgan vakolat
          scope: {
            regionId: user.regionId,
            districtId: user.districtId,
            schoolId: user.schoolId,
          },

          // Ko‘rsatish uchun hududiy ma’lumotlar
          region: resolvedRegion
            ? {
                id: resolvedRegion.id,
                name: resolvedRegion.name,
              }
            : null,

          district: resolvedDistrict
            ? {
                id: resolvedDistrict.id,
                name: resolvedDistrict.name,
              }
            : null,

          school: user.school
            ? {
                id: user.school.id,
                name: user.school.name,
              }
            : null,

          createdAt: user.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number, currentUser: AuthenticatedUser) {
    const query = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.district', 'district')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('district.region', 'districtRegion')
      .leftJoinAndSelect('school.district', 'schoolDistrict')
      .leftJoinAndSelect('schoolDistrict.region', 'schoolRegion')
      .where('user.id = :id', { id });

    this.applyReadScope(query, currentUser);

    const user = await query.getOne();

    if (!user) {
      throw new NotFoundException(
        'Foydalanuvchi topilmadi yoki ko‘rishga ruxsat yo‘q',
      );
    }

    const region =
      user.region ??
      user.district?.region ??
      user.school?.district?.region ??
      null;

    const district = user.district ?? user.school?.district ?? null;

    return {
      id: user.id,
      login: user.login,
      fullName: [user.lastName, user.firstName, user.middleName]
        .filter(Boolean)
        .join(' '),
      role: user.role,
      isActive: user.isActive,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      photoUrl: user.photoUrl,
      scope: {
        regionId: user.regionId,
        districtId: user.districtId,
        schoolId: user.schoolId,
      },

      region: region ? { id: region.id, name: region.name } : null,

      district: district ? { id: district.id, name: district.name } : null,

      school: user.school
        ? { id: user.school.id, name: user.school.name }
        : null,

      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(id: number, dto: UpdateUserDto, currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Foydalanuvchini tahrirlashga ruxsat yo‘q');
    }

    if (
      dto.firstName === undefined &&
      dto.lastName === undefined &&
      dto.middleName === undefined &&
      dto.login === undefined &&
      dto.password === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException(
        'O‘zgartirish uchun kamida bitta maydon yuboring',
      );
    }

    // Parol xeshini tranzaksiyadan oldin hisoblaymiz.
    const passwordHash =
      dto.password !== undefined ? await hashPassword(dto.password) : undefined;

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Foydalanuvchi topilmadi');
      }

      // Bosh administrator hisobini himoyalaymiz.
      if (user.role === UserRole.SUPER_ADMIN && dto.isActive === false) {
        throw new ForbiddenException(
          'Bosh administratorni bloklash mumkin emas',
        );
      }

      // Foydalanuvchi o‘z hisobini bloklay olmaydi.
      if (user.id === currentUser.id && dto.isActive === false) {
        throw new ForbiddenException('O‘z hisobingizni bloklay olmaysiz');
      }

      const loginChanged = dto.login !== undefined && dto.login !== user.login;
      if (dto.login !== undefined && dto.login !== user.login) {
        const existing = await manager.findOneBy(User, {
          login: dto.login,
        });

        if (existing && existing.id !== user.id) {
          throw new ConflictException('Ushbu login band');
        }

        user.login = dto.login;
      }

      if (dto.firstName !== undefined) {
        user.firstName = dto.firstName;
      }

      if (dto.lastName !== undefined) {
        user.lastName = dto.lastName;
      }

      if (dto.middleName !== undefined) {
        user.middleName = dto.middleName;
      }

      if (passwordHash !== undefined) {
        user.passwordHash = passwordHash;
      }

      if (dto.isActive !== undefined) {
        user.isActive = dto.isActive;
      }

      const saved = await manager.save(User, user);

      // Kirish ma'lumotlari o'zgarganda
      // yoki hisob bloklanganda sessiyalarni bekor qilamiz.
      const revokeSessions =
        dto.password !== undefined || loginChanged || dto.isActive === false;

      if (revokeSessions) {
        await manager
          .createQueryBuilder()
          .update(AuthSession)
          .set({ revokedAt: new Date() })
          .where('userId = :userId', { userId: id })
          .andWhere('revokedAt IS NULL')
          .execute();
      }

      return {
        id: saved.id,
        firstName: saved.firstName,
        lastName: saved.lastName,
        middleName: saved.middleName,
        login: saved.login,
        role: saved.role,
        isActive: saved.isActive,
        regionId: saved.regionId,
        districtId: saved.districtId,
        schoolId: saved.schoolId,
        updatedAt: saved.updatedAt,
      };
    });
  }

  async remove(id: number, currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Foydalanuvchini bloklashga ruxsat yo‘q');
    }

    if (id === currentUser.id) {
      throw new ForbiddenException('O‘z hisobingizni bloklay olmaysiz');
    }

    const result = await this.update(id, { isActive: false }, currentUser);

    return {
      message: 'Foydalanuvchi bloklandi',
      id: result.id,
      login: result.login,
      isActive: result.isActive,
    };
  }
}
