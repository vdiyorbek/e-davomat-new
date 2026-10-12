import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Brackets, DataSource, QueryFailedError } from 'typeorm';
import { hashPassword } from 'src/common/security/password';
import { Person } from '../persons/person.entity';
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
import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { SelectQueryBuilder } from 'typeorm/browser';

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateUserDto, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.USER) {
      throw new ForbiddenException('Foydalanuvchi yaratishga ruxsat yo‘q');
    }

    // Parol tranzaksiyadan tashqarida xeshlanadi.
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const person = await manager.findOne(Person, {
          where: { id: dto.personId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!person) {
          throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
        }

        // Hududiy administrator faqat o‘z vakolatidagi
        // maktabga faol biriktirilgan shaxsga hisob yaratadi.
        if (currentUser.role !== UserRole.SUPER_ADMIN) {
          const membershipQuery = manager
            .createQueryBuilder(SchoolMembership, 'membership')
            .innerJoin('membership.school', 'school')
            .innerJoin('school.district', 'district')
            .where('membership.personId = :personId', {
              personId: person.id,
            })
            .andWhere('membership.startDate <= CURRENT_DATE()')
            .andWhere(
              '(membership.endDate IS NULL OR membership.endDate >= CURRENT_DATE())',
            );

          switch (currentUser.role) {
            case UserRole.REGION_ADMIN:
              if (!currentUser.regionId) {
                throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
              }

              membershipQuery.andWhere('district.regionId = :regionId', {
                regionId: currentUser.regionId,
              });
              break;

            case UserRole.DISTRICT_ADMIN:
              if (!currentUser.districtId) {
                throw new ForbiddenException('Hisobga tuman biriktirilmagan');
              }

              membershipQuery.andWhere('school.districtId = :districtId', {
                districtId: currentUser.districtId,
              });
              break;

            case UserRole.SCHOOL_ADMIN:
              if (!currentUser.schoolId) {
                throw new ForbiddenException('Hisobga maktab biriktirilmagan');
              }

              membershipQuery.andWhere('membership.schoolId = :schoolId', {
                schoolId: currentUser.schoolId,
              });
              break;

            default:
              throw new ForbiddenException(
                'Foydalanuvchi yaratishga ruxsat yo‘q',
              );
          }

          const membership = await membershipQuery.getOne();

          if (!membership) {
            throw new ForbiddenException(
              'Shaxs sizning hududingizdagi faol maktab a’zosi emas',
            );
          }
        }

        const existingAccount = await manager.findOneBy(User, {
          personId: person.id,
        });

        if (existingAccount) {
          throw new ConflictException(
            'Bu shaxsning foydalanuvchi hisobi mavjud',
          );
        }

        const loginOwner = await manager.findOneBy(User, {
          login: dto.login,
        });

        if (loginOwner) {
          throw new ConflictException('Ushbu login band');
        }

        const user = manager.create(User, {
          personId: person.id,
          login: dto.login,
          passwordHash,
          isActive: true,
          role: UserRole.USER,
          regionId: null,
          districtId: null,
          schoolId: null,
        });

        const saved = await manager.save(User, user);

        return {
          id: saved.id,
          personId: saved.personId,
          login: saved.login,
          role: saved.role,
          isActive: saved.isActive,
          createdAt: saved.createdAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Login band yoki shaxsning foydalanuvchi hisobi mavjud',
          );
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

    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      currentUser.role !== UserRole.REGION_ADMIN &&
      currentUser.role !== UserRole.DISTRICT_ADMIN
    ) {
      throw new ForbiddenException(
        'Rol va hududiy vakolatlarni o‘zgartirishga ruxsat yo‘q',
      );
    }

    if (id === currentUser.id) {
      throw new ForbiddenException('O‘z vakolatingizni o‘zgartira olmaysiz');
    }

    if (ranks[dto.role] >= ranks[currentUser.role]) {
      throw new ForbiddenException(
        'O‘zingizga teng yoki yuqori rolni bera olmaysiz',
      );
    }

    const regionId = dto.regionId ?? null;
    const districtId = dto.districtId ?? null;
    const schoolId = dto.schoolId ?? null;

    const validScope =
      (dto.role === UserRole.USER &&
        regionId === null &&
        districtId === null &&
        schoolId === null) ||
      (dto.role === UserRole.REGION_ADMIN &&
        regionId !== null &&
        districtId === null &&
        schoolId === null) ||
      (dto.role === UserRole.DISTRICT_ADMIN &&
        regionId === null &&
        districtId !== null &&
        schoolId === null) ||
      (dto.role === UserRole.SCHOOL_ADMIN &&
        regionId === null &&
        districtId === null &&
        schoolId !== null);

    if (!validScope) {
      throw new BadRequestException('Tanlangan rolga mos hududni yuboring');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Foydalanuvchi topilmadi');
      }

      if (!user.isActive) {
        throw new BadRequestException(
          'Bloklangan akkauntning vakolatini o‘zgartirib bo‘lmaydi',
        );
      }

      if (
        user.role === UserRole.SUPER_ADMIN ||
        ranks[user.role] >= ranks[currentUser.role]
      ) {
        throw new ForbiddenException(
          'Ushbu administrator vakolatini o‘zgartira olmaysiz',
        );
      }

      const person = await manager.findOneBy(Person, {
        id: user.personId,
      });

      if (!person || person.deletedAt !== null) {
        throw new NotFoundException('Shaxs topilmadi');
      }

      // Amaldagi va yangi hududlarni aniqlash
      async function resolveLocation(
        role: UserRole,
        rId: number | null,
        dId: number | null,
        sId: number | null,
      ) {
        if (role === UserRole.REGION_ADMIN) {
          if (!rId) {
            throw new BadRequestException('Viloyat tanlanmagan');
          }

          const region = await manager.findOneBy(Region, {
            id: rId,
          });

          if (!region) {
            throw new NotFoundException('Viloyat topilmadi');
          }

          return { regionId: region.id, districtId: null };
        }

        if (role === UserRole.DISTRICT_ADMIN) {
          if (!dId) {
            throw new BadRequestException('Tuman tanlanmagan');
          }

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

        if (role === UserRole.SCHOOL_ADMIN) {
          if (!sId) {
            throw new BadRequestException('Maktab tanlanmagan');
          }

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

        return { regionId: null, districtId: null };
      }

      const newLocation = await resolveLocation(
        dto.role,
        regionId,
        districtId,
        schoolId,
      );

      // Berilayotgan yangi hudud vakolat ichida bo‘lishi kerak
      if (currentUser.role === UserRole.REGION_ADMIN) {
        if (
          !currentUser.regionId ||
          (dto.role !== UserRole.USER &&
            newLocation.regionId !== currentUser.regionId)
        ) {
          throw new ForbiddenException(
            'Faqat o‘z viloyatingizga vakolat bera olasiz',
          );
        }
      }

      if (currentUser.role === UserRole.DISTRICT_ADMIN) {
        if (
          !currentUser.districtId ||
          (dto.role !== UserRole.USER &&
            newLocation.districtId !== currentUser.districtId)
        ) {
          throw new ForbiddenException(
            'Faqat o‘z tumaningizga vakolat bera olasiz',
          );
        }
      }

      // Avvalgi vakolat ham administrator hududida bo‘lishi kerak.
      if (
        currentUser.role !== UserRole.SUPER_ADMIN &&
        user.role !== UserRole.USER
      ) {
        const oldLocation = await resolveLocation(
          user.role,
          user.regionId,
          user.districtId,
          user.schoolId,
        );

        if (
          currentUser.role === UserRole.REGION_ADMIN &&
          oldLocation.regionId !== currentUser.regionId
        ) {
          throw new ForbiddenException(
            'Foydalanuvchining avvalgi vakolati boshqa viloyatda',
          );
        }

        if (
          currentUser.role === UserRole.DISTRICT_ADMIN &&
          oldLocation.districtId !== currentUser.districtId
        ) {
          throw new ForbiddenException(
            'Foydalanuvchining avvalgi vakolati boshqa tumanda',
          );
        }
      }

      // USER rolida hudud saqlanmagani sababli uning
      // faol maktab a’zoligi orqali ruxsat tekshiriladi.
      if (
        currentUser.role !== UserRole.SUPER_ADMIN &&
        user.role === UserRole.USER
      ) {
        const membershipQuery = manager
          .createQueryBuilder(SchoolMembership, 'membership')
          .innerJoin('membership.school', 'school')
          .innerJoin('school.district', 'district')
          .where('membership.personId = :personId', {
            personId: user.personId,
          })
          .andWhere('membership.startDate <= CURRENT_DATE()')
          .andWhere(
            '(membership.endDate IS NULL OR membership.endDate >= CURRENT_DATE())',
          );

        if (currentUser.role === UserRole.REGION_ADMIN) {
          membershipQuery.andWhere('district.regionId = :scopeRegionId', {
            scopeRegionId: currentUser.regionId,
          });
        } else {
          membershipQuery.andWhere('school.districtId = :scopeDistrictId', {
            scopeDistrictId: currentUser.districtId,
          });
        }

        const membership = await membershipQuery.getOne();

        if (!membership) {
          throw new ForbiddenException(
            'Foydalanuvchi sizning hududingizdagi faol maktab a’zosi emas',
          );
        }
      }

      const accessChanged =
        user.role !== dto.role ||
        user.regionId !== regionId ||
        user.districtId !== districtId ||
        user.schoolId !== schoolId;

      if (!accessChanged) {
        return {
          id: user.id,
          login: user.login,
          role: user.role,
          regionId: user.regionId,
          districtId: user.districtId,
          schoolId: user.schoolId,
          message: 'Vakolat o‘zgarmagan',
        };
      }

      user.role = dto.role;
      user.regionId = regionId;
      user.districtId = districtId;
      user.schoolId = schoolId;

      await manager.save(User, user);

      // Eski JWT sessiyalari yangi vakolat bilan ishlamasin.
      await manager
        .createQueryBuilder()
        .update(AuthSession)
        .set({ revokedAt: new Date() })
        .where('userId = :userId', { userId: user.id })
        .andWhere('revokedAt IS NULL')
        .execute();

      return {
        id: user.id,
        login: user.login,
        role: user.role,
        regionId: user.regionId,
        districtId: user.districtId,
        schoolId: user.schoolId,
        message: 'Foydalanuvchi vakolati yangilandi',
      };
    });
  }

  private applyReadScope(
    query: SelectQueryBuilder<User>,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    const membership = query
      .subQuery()
      .select('1')
      .from(SchoolMembership, 'sm')
      .innerJoin('sm.school', 'ms')
      .innerJoin('ms.district', 'md')
      .where('sm.personId = user.personId')
      .andWhere('sm.startDate <= CURRENT_DATE()')
      .andWhere('(sm.endDate IS NULL OR sm.endDate >= CURRENT_DATE())');

    switch (currentUser.role) {
      case UserRole.REGION_ADMIN:
        if (!currentUser.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        membership.andWhere('md.regionId = :scopeRegionId', {
          scopeRegionId: currentUser.regionId,
        });

        query.andWhere(
          new Brackets((qb) => {
            qb.where('user.regionId = :scopeRegionId')
              .orWhere('district.regionId = :scopeRegionId')
              .orWhere('schoolDistrict.regionId = :scopeRegionId')
              .orWhere(
                `(
                user.role = :ordinaryRole
                AND EXISTS ${membership.getQuery()}
              )`,
              );
          }),
          {
            scopeRegionId: currentUser.regionId,
            ordinaryRole: UserRole.USER,
          },
        );
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!currentUser.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        membership.andWhere('ms.districtId = :scopeDistrictId', {
          scopeDistrictId: currentUser.districtId,
        });

        query.andWhere(
          new Brackets((qb) => {
            qb.where('user.districtId = :scopeDistrictId')
              .orWhere('school.districtId = :scopeDistrictId')
              .orWhere(
                `(
                user.role = :ordinaryRole
                AND EXISTS ${membership.getQuery()}
              )`,
              );
          }),
          {
            scopeDistrictId: currentUser.districtId,
            ordinaryRole: UserRole.USER,
          },
        );
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!currentUser.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        membership.andWhere('sm.schoolId = :scopeSchoolId', {
          scopeSchoolId: currentUser.schoolId,
        });

        query.andWhere(
          new Brackets((qb) => {
            qb.where('user.schoolId = :scopeSchoolId').orWhere(
              `(
                user.role = :ordinaryRole
                AND EXISTS ${membership.getQuery()}
              )`,
            );
          }),
          {
            scopeSchoolId: currentUser.schoolId,
            ordinaryRole: UserRole.USER,
          },
        );
        break;

      default:
        throw new ForbiddenException(
          'Foydalanuvchilarni ko‘rishga ruxsat yo‘q',
        );
    }

    query.setParameters(membership.getParameters());
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
      .innerJoinAndSelect('user.person', 'person')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.district', 'district')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('district.region', 'districtRegion')
      .leftJoinAndSelect('school.district', 'schoolDistrict')
      .leftJoinAndSelect('schoolDistrict.region', 'schoolRegion')
      .andWhere('person.deletedAt IS NULL');

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
              .orWhere(`person.firstName LIKE :${param} ESCAPE '!'`)
              .orWhere(`person.lastName LIKE :${param} ESCAPE '!'`)
              .orWhere(`person.middleName LIKE :${param} ESCAPE '!'`);
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
          personId: user.personId,
          fullName: [
            user.person.lastName,
            user.person.firstName,
            user.person.middleName,
          ]
            .filter(Boolean)
            .join(' '),
          role: user.role,
          isActive: user.isActive,

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
      .innerJoinAndSelect('user.person', 'person')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.district', 'district')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('district.region', 'districtRegion')
      .leftJoinAndSelect('school.district', 'schoolDistrict')
      .leftJoinAndSelect('schoolDistrict.region', 'schoolRegion')
      .where('user.id = :id', { id })
      .andWhere('person.deletedAt IS NULL');

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
      personId: user.personId,
      login: user.login,
      fullName: [
        user.person.lastName,
        user.person.firstName,
        user.person.middleName,
      ]
        .filter(Boolean)
        .join(' '),
      role: user.role,
      isActive: user.isActive,

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
        login: saved.login,
        role: saved.role,
        isActive: saved.isActive,
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
