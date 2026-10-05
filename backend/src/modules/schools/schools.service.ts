import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { District } from '../districts/district.entity';
import { School } from './school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { GetSchoolsQueryDto } from './dto/get-schools-query.dto';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,

    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,
  ) {}

  async findAll(
    query: GetSchoolsQueryDto,
    user: AuthenticatedUser,
  ): Promise<School[]> {
    const builder = this.schoolsRepository
      .createQueryBuilder('school')
      .innerJoinAndSelect('school.district', 'district')
      .innerJoinAndSelect('district.region', 'region');

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;
      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        builder.andWhere('district.regionId = :scopeRegionId', {
          scopeRegionId: user.regionId,
        });
        break;
      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        builder.andWhere('school.districtId = :scopeDistrictId', {
          scopeDistrictId: user.districtId,
        });
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        builder.andWhere('school.id = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Maktablar ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
    }

    if (query.regionId !== undefined) {
      builder.andWhere('district.regionId = :filterRegionId', {
        filterRegionId: query.regionId,
      });
    }

    if (query.districtId !== undefined) {
      builder.andWhere('school.districtId = :filterDistrictId', {
        filterDistrictId: query.districtId,
      });
    }

    return builder
      .orderBy('school.name', 'ASC')
      .addOrderBy('school.id', 'ASC')
      .getMany();
  }

  async create(dto: CreateSchoolDto): Promise<School> {
    const district = await this.districtsRepository.findOneBy({
      id: dto.districtId,
    });

    if (!district) {
      throw new NotFoundException('Tanlangan tuman yoki shahar topilmadi');
    }

    const school = this.schoolsRepository.create({
      name: dto.name,
      districtId: dto.districtId,
    });

    try {
      return await this.schoolsRepository.save(school);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu tumanda bu nomdagi maktab allaqachon mavjud',
          );
        }

        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException('Tanlangan tuman yoki shahar topilmadi');
        }
      }

      throw error;
    }
  }

  async update(id: number, dto: UpdateSchoolDto): Promise<School> {
    if (dto.name === undefined && dto.districtId === undefined) {
      throw new BadRequestException(
        "O'zgartirish uchun kamida bitta maydon yuboring.",
      );
    }
    const school = await this.schoolsRepository.findOneBy({ id });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi!');
    }
    if (dto.districtId !== undefined) {
      const district = await this.districtsRepository.findOneBy({
        id: dto.districtId,
      });
      if (!district) {
        throw new NotFoundException('Tanlangan tuman yoki shahar topilmadi.');
      }
    }

    const changes: {
      name?: string;
      districtId?: number;
    } = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.districtId !== undefined) {
      changes.districtId = dto.districtId;
    }

    try {
      await this.schoolsRepository.update(id, changes);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu tumanda bu nomdagi maktab allaqachon mavjud',
          );
        }

        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException('Tanlangan tuman yoki shahar topilmadi');
        }
      }

      throw error;
    }

    const updatedSchool = await this.schoolsRepository.findOne({
      where: { id },
      relations: {
        district: {
          region: true,
        },
      },
    });

    if (!updatedSchool) {
      throw new NotFoundException('Maktab topilmadi');
    }

    return updatedSchool;
  }
}
