import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { SchoolMembership } from './school-membership.entity';
import { CreateSchoolMembershipDto } from './dto/create-school-membership.dto';
import { GetSchoolMembershipsQueryDto } from './dto/get-school-memberships-query.dto';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { EndSchoolMembershipDto } from './dto/end-school-membership.dto';
import { MembershipStatus } from './enums/membership-status.enum';

export interface SchoolMembershipsPage {
  data: SchoolMembership[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SchoolMembershipsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(SchoolMembership)
    private readonly membershipsRepository: Repository<SchoolMembership>,
  ) {}

  private todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string): string =>
      parts.find((part) => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  async create(dto: CreateSchoolMembershipDto): Promise<SchoolMembership> {
    const endDate = dto.endDate ?? null;

    if (endDate !== null && endDate <= dto.startDate) {
      throw new BadRequestException(
        'endDate startDate sanasidan keyin bo‘lishi kerak',
      );
    }

    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          const person = await manager.findOne(Person, {
            where: { id: dto.personId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!person) {
            throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
          }

          const school = await manager.findOneBy(School, {
            id: dto.schoolId,
          });

          if (!school) {
            throw new NotFoundException('Maktab topilmadi');
          }

          const repository = manager.getRepository(SchoolMembership);

          const overlapQuery = repository
            .createQueryBuilder('membership')
            .where('membership.personId = :personId', {
              personId: dto.personId,
            })
            .andWhere('membership.schoolId = :schoolId', {
              schoolId: dto.schoolId,
            })
            .andWhere('membership.type = :type', {
              type: dto.type,
            })
            .andWhere(
              '(membership.endDate IS NULL OR membership.endDate > :startDate)',
              { startDate: dto.startDate },
            );

          if (endDate !== null) {
            overlapQuery.andWhere('membership.startDate < :endDate', {
              endDate,
            });
          }

          const overlappingMembership = await overlapQuery.getOne();

          if (overlappingMembership) {
            throw new ConflictException(
              'Shaxsning ushbu maktabdagi shu maqomi uchun davrlar ustma-ust kelmoqda',
            );
          }

          const membership = repository.create({
            personId: dto.personId,
            schoolId: dto.schoolId,
            type: dto.type,
            startDate: dto.startDate,
            endDate,
          });

          return repository.save(membership);
        },
      );
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu maktabga bog‘lanish allaqachon mavjud',
          );
        }

        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException(
            'Bog‘lanayotgan shaxs yoki maktab topilmadi',
          );
        }
      }

      throw error;
    }
  }

  async findAll(
    query: GetSchoolMembershipsQueryDto,
    user: AuthenticatedUser,
  ): Promise<SchoolMembershipsPage> {
    const { page, limit, personId, regionId, districtId, schoolId, type, q } =
      query;

    const builder = this.membershipsRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.person', 'person')
      .innerJoinAndSelect('membership.school', 'school')
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

        builder.andWhere('membership.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Bog‘lanishlar ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
    }

    if (personId !== undefined) {
      builder.andWhere('membership.personId = :filterPersonId', {
        filterPersonId: personId,
      });
    }

    if (schoolId !== undefined) {
      builder.andWhere('membership.schoolId = :filterSchoolId', {
        filterSchoolId: schoolId,
      });
    }

    if (type !== undefined) {
      builder.andWhere('membership.type = :filterType', {
        filterType: type,
      });
    }

    if (regionId !== undefined) {
      builder.andWhere('district.regionId = :filterRegionId', {
        filterRegionId: regionId,
      });
    }

    if (districtId !== undefined) {
      builder.andWhere('school.districtId = :filterDistrictId', {
        filterDistrictId: districtId,
      });
    }

    if (q) {
      const words = q.split(/\s+/).filter(Boolean);

      words.forEach((word, index) => {
        // LIKE ichidagi %, _ va ! belgilarini oddiy matn sifatida izlaymiz.
        const escapedWord = word.replace(/[!%_]/g, '!$&');
        const parameterName = `searchWord${index}`;

        builder.andWhere(
          `(
        person.firstName LIKE :${parameterName} ESCAPE '!'
        OR person.lastName LIKE :${parameterName} ESCAPE '!'
        OR person.middleName LIKE :${parameterName} ESCAPE '!'
        OR person.pnfl LIKE :${parameterName} ESCAPE '!'
      )`,
          {
            [parameterName]: `%${escapedWord}%`,
          },
        );
      });
    }

    if (query.status !== undefined) {
      const today = this.todayInTashkent();

      switch (query.status) {
        case MembershipStatus.ACTIVE:
          builder.andWhere(
            `(
          membership.startDate <= :statusToday
          AND (
            membership.endDate IS NULL
            OR membership.endDate > :statusToday
          )
        )`,
            { statusToday: today },
          );
          break;

        case MembershipStatus.ENDED:
          builder.andWhere('membership.endDate <= :statusToday', {
            statusToday: today,
          });
          break;

        case MembershipStatus.PLANNED:
          builder.andWhere('membership.startDate > :statusToday', {
            statusToday: today,
          });
          break;
      }
    }

    const [data, total] = await builder
      .orderBy('membership.startDate', 'DESC')
      .addOrderBy('membership.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async endMembership(
    id: number,
    dto: EndSchoolMembershipDto,
  ): Promise<SchoolMembership> {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Bog‘lanish identifikatori noto‘g‘ri');
    }

    const existing = await this.membershipsRepository.findOneBy({ id });

    if (!existing) {
      throw new NotFoundException('Maktabga bog‘lanish topilmadi');
    }

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Yangi bog‘lanish yaratishdagi kabi avval shaxsni qulflaymiz.
      const person = await manager.findOne(Person, {
        where: { id: existing.personId },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });

      if (!person) {
        throw new NotFoundException('Shaxs topilmadi');
      }

      const repository = manager.getRepository(SchoolMembership);

      const membership = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!membership) {
        throw new NotFoundException('Maktabga bog‘lanish topilmadi');
      }

      if (dto.endDate <= membership.startDate) {
        throw new BadRequestException(
          'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
        );
      }

      // Bir xil so‘rov qayta yuborilsa ham muvaffaqiyatli qaytadi.
      if (membership.endDate === dto.endDate) {
        return membership;
      }

      // Bu endpoint faoliyat davrini faqat qisqartiradi.
      if (membership.endDate !== null && dto.endDate > membership.endDate) {
        throw new BadRequestException(
          'Ushbu amal orqali tugash sanasini uzaytirib bo‘lmaydi',
        );
      }

      membership.endDate = dto.endDate;

      return repository.save(membership);
    });
  }
}
