import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';

import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { Mahalla } from './mahalla.entity';
import { CreateMahallaDto } from './dto/create-mahalla.dto';
import { ListMahallasDto } from './dto/list-mahallas.dto';

export interface MahallaAccess {
  role: UserRole;
  regionId: number | null;
  districtId: number | null;
  schoolId: number | null;
}

@Injectable()
export class MahallasService {
  constructor(
    @InjectRepository(Mahalla)
    private readonly mahallasRepository: Repository<Mahalla>,

    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,

    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,
  ) {}

  async create(dto: CreateMahallaDto, user: MahallaAccess) {
    if (
      ![
        UserRole.SUPER_ADMIN,
        UserRole.REGION_ADMIN,
        UserRole.DISTRICT_ADMIN,
      ].includes(user.role)
    ) {
      throw new ForbiddenException('Mahalla qo‘shishga ruxsat berilmagan');
    }

    const districtQuery = this.districtsRepository
      .createQueryBuilder('district')
      .where('district.id = :districtId', {
        districtId: dto.districtId,
      });

    if (user.role === UserRole.REGION_ADMIN) {
      if (!user.regionId) {
        throw new ForbiddenException('Viloyat biriktirilmagan');
      }

      districtQuery.andWhere('district.regionId = :regionId', {
        regionId: user.regionId,
      });
    }

    if (user.role === UserRole.DISTRICT_ADMIN) {
      if (!user.districtId) {
        throw new ForbiddenException('Tuman biriktirilmagan');
      }

      districtQuery.andWhere('district.id = :scopeDistrictId', {
        scopeDistrictId: user.districtId,
      });
    }

    const district = await districtQuery.getOne();

    if (!district) {
      throw new NotFoundException(
        'Tuman topilmadi yoki ushbu tumanga ruxsatingiz yo‘q',
      );
    }

    const mahalla = this.mahallasRepository.create({
      districtId: district.id,
      name: dto.name,
      isActive: true,
    });

    try {
      return await this.mahallasRepository.save(mahalla);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu tumanda bu nomdagi mahalla mavjud',
          );
        }
      }

      throw error;
    }
  }

  async findAll(dto: ListMahallasDto, user: MahallaAccess) {
    const query = this.mahallasRepository
      .createQueryBuilder('mahalla')
      .innerJoinAndSelect('mahalla.district', 'district');

    await this.applyScope(query, user);

    if (dto.districtId !== undefined) {
      query.andWhere('mahalla.districtId = :filterDistrictId', {
        filterDistrictId: dto.districtId,
      });
    }

    const [items, total] = await query
      .orderBy('mahalla.name', 'ASC')
      .addOrderBy('mahalla.id', 'ASC')
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getManyAndCount();

    return {
      data: items.map((mahalla) => ({
        id: mahalla.id,
        name: mahalla.name,
        districtId: mahalla.districtId,
        isActive: mahalla.isActive,
        district: {
          id: mahalla.district.id,
          name: mahalla.district.name,
          regionId: mahalla.district.regionId,
        },
        createdAt: mahalla.createdAt,
        updatedAt: mahalla.updatedAt,
      })),
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit),
    };
  }

  async findOptions(dto: ListMahallasDto) {
    if (dto.districtId === undefined) {
      throw new BadRequestException('Tumanni tanlang');
    }

    const [items, total] = await this.mahallasRepository.findAndCount({
      select: {
        id: true,
        name: true,
        districtId: true,
      },
      where: {
        districtId: dto.districtId,
        isActive: true,
      },
      order: {
        name: 'ASC',
        id: 'ASC',
      },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
    });

    return {
      data: items.map((mahalla) => ({
        id: mahalla.id,
        name: mahalla.name,
        districtId: mahalla.districtId,
      })),
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit),
    };
  }

  private async applyScope(
    query: SelectQueryBuilder<Mahalla>,
    user: MahallaAccess,
  ): Promise<void> {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return;

      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Viloyat biriktirilmagan');
        }

        query.andWhere('district.regionId = :scopeRegionId', {
          scopeRegionId: user.regionId,
        });
        return;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Tuman biriktirilmagan');
        }

        query.andWhere('mahalla.districtId = :scopeDistrictId', {
          scopeDistrictId: user.districtId,
        });
        return;

      case UserRole.SCHOOL_ADMIN: {
        if (!user.schoolId) {
          throw new ForbiddenException('Maktab biriktirilmagan');
        }

        const school = await this.schoolsRepository.findOne({
          where: { id: user.schoolId },
        });

        if (!school) {
          throw new ForbiddenException('Biriktirilgan maktab topilmadi');
        }

        query.andWhere('mahalla.districtId = :scopeDistrictId', {
          scopeDistrictId: school.districtId,
        });
        return;
      }

      default:
        throw new ForbiddenException(
          'Mahallalar ro‘yxatini ko‘rishga ruxsat berilmagan',
        );
    }
  }
}
