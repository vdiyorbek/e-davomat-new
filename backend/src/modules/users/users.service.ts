import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { hashPassword } from 'src/common/security/password';
import { Person } from '../persons/person.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './enums/user-role.enum';
import { User } from './user.entity';
import { Region } from '../regions/region.entity';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

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
}
