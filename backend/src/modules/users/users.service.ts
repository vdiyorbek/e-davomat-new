import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Brackets, DataSource, QueryFailedError, Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const person = await manager.findOne(Person, {
          where: { id: dto.personId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!person) {
          throw new NotFoundException('Shaxs topilmadi yoki arxivlangan.');
        }

        const existingAccount = await manager.findOneBy(User, {
          personId: person.id,
        });

        if (existingAccount) {
          throw new ConflictException(
            'Bu shaxsning kabinet hisobi allaqachon mavjud.',
          );
        }

        const loginOwner = await manager.findOneBy(User, {
          login: dto.login,
        });

        if (loginOwner) {
          throw new ConflictException('Bu login band!');
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

        const saved = await manager.save(user);

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
            'Login band yoki shaxsning kabinet hisobi mavjud',
          );
        }

        if (driverError.code === 'ER_NOREFERENCED_ROW_2') {
          throw new NotFoundException('Shaxs topilmadi');
        }
      }
      throw error;
    }
  }

  async updateAccess(id: number, dto: UpdateUserAccessDto) {
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
        districtId == null &&
        schoolId === null) ||
      (dto.role === UserRole.DISTRICT_ADMIN &&
        regionId == null &&
        districtId !== null &&
        schoolId === null) ||
      (dto.role === UserRole.SCHOOL_ADMIN &&
        regionId === null &&
        districtId === null &&
        schoolId !== null);

    if (!validScope) {
      throw new BadRequestException(
        'Rolga mos bitta hududni yuboring. USER uchun hudud yuborilmaydi.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Hisob topilmadi!');
      }

      if (user.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          "Bosh administrator huquqini ushbu API orqali o'zgartirib bo'lmaydi.",
        );
      }

      const person = await manager.findOneBy(Person, {
        id: user.personId,
      });

      if (!person) {
        throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
      }

      if (!user.isActive) {
        throw new BadRequestException('Hisob faol emas');
      }

      if (regionId !== null) {
        const region = await manager.findOne(Region, {
          where: { id: regionId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!region) {
          throw new NotFoundException('Viloyat topilmadi');
        }
      }

      if (districtId !== null) {
        const district = await manager.findOne(District, {
          where: { id: districtId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!district) {
          throw new NotFoundException('Tuman yoki shahar topilmadi');
        }
      }

      if (schoolId !== null) {
        const school = await manager.findOne(School, {
          where: { id: schoolId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!school) {
          throw new NotFoundException('Maktab topilmadi');
        }
      }

      await manager.update(User, user.id, {
        role: dto.role,
        regionId,
        districtId,
        schoolId,
      });

      return {
        id: user.id,
        login: user.login,
        role: dto.role,
        regionId,
        districtId,
        schoolId,
      };
    });
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
    const take = Math.min(Math.max(limit, 1), 100);
    const currentPage = Math.max(page, 1);

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

    switch (currentUser.role) {
      case UserRole.SUPER_ADMIN:
        break;

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
        break;

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
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!currentUser.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        query.andWhere('user.schoolId = :scopeSchoolId', {
          scopeSchoolId: currentUser.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Foydalanuvchilar ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
    }

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
}
