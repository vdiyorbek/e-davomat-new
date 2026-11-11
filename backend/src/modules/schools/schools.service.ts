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
import { School } from './school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { GetSchoolsQueryDto } from './dto/get-schools-query.dto';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UpdateSchoolDto } from './dto/update-school.dto';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { Terminal } from '../terminals/terminal.entity';
import { GetSchoolsPageQueryDto } from './dto/get-schools-page-query.dto';

export interface SchoolStats {
  students: number;
  teachers: number;
  terminals: number;
  activeTerminals: number;
}

const EMPTY_STATS: SchoolStats = {
  students: 0,
  teachers: 0,
  terminals: 0,
  activeTerminals: 0,
};

/**
 * Qidiruv matni: maktab, tuman va viloyat nomi birga, apostroflarsiz.
 * «Qo‘rg‘on», «Qo'rg'on» va «Qorgon» bir xil topiladi.
 */
const SEARCH_TEXT_SQL = ["'", '‘', '’', 'ʻ', 'ʼ', '`'].reduce(
  (sql, char) => `REPLACE(${sql}, '${char === "'" ? "''" : char}', '')`,
  "CONCAT_WS(' ', school.name, district.name, region.name)",
);

function todayInTashkent(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,

    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,
  ) {}

  /** Foydalanuvchi vakolati va hudud filtrlari qo‘llangan so‘rov. */
  private scopedQuery(
    query: GetSchoolsQueryDto,
    user: AuthenticatedUser,
  ): SelectQueryBuilder<School> {
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

    return builder;
  }

  /** To‘liq ro‘yxat — tanlash ro‘yxatlari (select) uchun. O‘zgarmagan. */
  async findAll(
    query: GetSchoolsQueryDto,
    user: AuthenticatedUser,
  ): Promise<School[]> {
    return this.scopedQuery(query, user)
      .orderBy('school.name', 'ASC')
      .addOrderBy('school.id', 'ASC')
      .getMany();
  }

  /** Sahifalangan ro‘yxat: qidiruv, filtrlar va har maktab statistikasi. */
  async findPage(query: GetSchoolsPageQueryDto, user: AuthenticatedUser) {
    const { page, limit, q } = query;
    const builder = this.scopedQuery(query, user);

    if (q) {
      const words = q
        .split(/\s+/)
        .map((word) => word.replace(/['‘’ʻʼ`]/g, ''))
        .filter(Boolean);

      words.forEach((word, index) => {
        // LIKE ichidagi %, _ va ! belgilarini oddiy matn sifatida izlaymiz.
        const escaped = word.replace(/[!%_]/g, '!$&');
        const textParam = `searchWord${index}`;
        const idParam = `searchId${index}`;
        const byId = /^\d{1,10}$/.test(word);

        builder.andWhere(
          `(${SEARCH_TEXT_SQL} LIKE :${textParam} ESCAPE '!'` +
            (byId ? ` OR school.id = :${idParam}` : '') +
            ')',
          {
            [textParam]: `%${escaped}%`,
            ...(byId ? { [idParam]: Number(word) } : {}),
          },
        );
      });
    }

    const [schools, total] = await builder
      .orderBy('school.name', 'ASC')
      .addOrderBy('school.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const stats = await this.loadStats(schools.map((school) => school.id));

    return {
      data: schools.map((school) => ({
        ...school,
        stats: stats.get(school.id) ?? EMPTY_STATS,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Faqat joriy sahifadagi maktablar uchun: 2 ta guruhlangan so‘rov. */
  private async loadStats(
    schoolIds: number[],
  ): Promise<Map<number, SchoolStats>> {
    const result = new Map<number, SchoolStats>();

    if (schoolIds.length === 0) {
      return result;
    }

    const today = todayInTashkent();
    const manager = this.schoolsRepository.manager;

    const [memberships, terminals] = await Promise.all([
      manager
        .createQueryBuilder(SchoolMembership, 'membership')
        .select('membership.schoolId', 'schoolId')
        .addSelect(
          'COUNT(DISTINCT CASE WHEN membership.type = :student THEN membership.personId END)',
          'students',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN membership.type = :teacher THEN membership.personId END)',
          'teachers',
        )
        .where('membership.schoolId IN (:...schoolIds)', { schoolIds })
        .andWhere('membership.startDate <= :today', { today })
        .andWhere(
          '(membership.endDate IS NULL OR membership.endDate > :today)',
          { today },
        )
        .setParameter('student', MembershipType.STUDENT)
        .setParameter('teacher', MembershipType.TEACHER)
        .groupBy('membership.schoolId')
        .getRawMany<{
          schoolId: number | string;
          students: number | string;
          teachers: number | string;
        }>(),

      manager
        .createQueryBuilder(Terminal, 'terminal')
        .select('terminal.schoolId', 'schoolId')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(terminal.isActive = 1)', 'active')
        .where('terminal.schoolId IN (:...schoolIds)', { schoolIds })
        .andWhere('terminal.archivedAt IS NULL')
        .groupBy('terminal.schoolId')
        .getRawMany<{
          schoolId: number | string;
          total: number | string;
          active: number | string | null;
        }>(),
    ]);

    const get = (schoolId: number) => {
      const current = result.get(schoolId) ?? { ...EMPTY_STATS };
      result.set(schoolId, current);
      return current;
    };

    for (const row of memberships) {
      const stats = get(Number(row.schoolId));
      stats.students = Number(row.students);
      stats.teachers = Number(row.teachers);
    }

    for (const row of terminals) {
      const stats = get(Number(row.schoolId));
      stats.terminals = Number(row.total);
      stats.activeTerminals = Number(row.active ?? 0);
    }

    return result;
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
