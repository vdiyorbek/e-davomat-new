import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
  IsNull,
} from 'typeorm';
import { Person } from './person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { GetPersonsQueryDto } from './dto/get-persons-query.dto';
import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Mahalla } from '../mahallas/mahalla.entity';

export interface PersonsPage {
  data: Person[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,

    @InjectRepository(Mahalla)
    private readonly mahallasRepository: Repository<Mahalla>,
  ) {}

  private async validateMahalla(
    mahallaId: number | null | undefined,
  ): Promise<void> {
    if (mahallaId === undefined || mahallaId === null) {
      return;
    }

    const mahalla = await this.mahallasRepository.findOneBy({
      id: mahallaId,
      isActive: true,
    });

    if (!mahalla) {
      throw new BadRequestException(
        'Tanlangan mahalla mavjud emas yoki faol emas',
      );
    }
  }

  private createScopedQuery(
    user: AuthenticatedUser,
  ): SelectQueryBuilder<Person> {
    const builder = this.personsRepository.createQueryBuilder('person');
    if (user.role === UserRole.SUPER_ADMIN) {
      return builder;
    }
    const membershipQuery = builder
      .subQuery()
      .select('1')
      .from(SchoolMembership, 'membership')
      .innerJoin('membership.school', 'school')
      .innerJoin('school.district', 'district')
      .where('membership.personId = person.id');

    switch (user.role) {
      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        membershipQuery.andWhere('district.regionId = :scopeRegionId', {
          scopeRegionId: user.regionId,
        });
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        membershipQuery.andWhere('school.districtId = :scopeDistrictId', {
          scopeDistrictId: user.districtId,
        });
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        membershipQuery.andWhere('membership.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException('Shaxslarni ko‘rishga ruxsat yo‘q');
    }

    return builder
      .andWhere(`EXISTS ${membershipQuery.getQuery()}`)
      .setParameters(membershipQuery.getParameters());
  }

  async create(dto: CreatePersonDto): Promise<Person> {
    await this.validateMahalla(dto.mahallaId);
    const person = this.personsRepository.create({
      pnfl: dto.pnfl,
      firstName: dto.firstName,
      lastName: dto.lastName,
      middleName: dto.middleName ?? null,
      gender: dto.gender ?? null,
      nationality: dto.nationality ?? null,
      birthDate: dto.birthDate ?? null,
      address: dto.address ?? null,
      phoneNumber: dto.phoneNumber ?? null,
      mahallaId: dto.mahallaId ?? null,
    });

    try {
      return await this.personsRepository.save(person);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu PNFL bilan shaxs mavjud. Arxivlangan yozuvlarni ham tekshiring',
          );
        }
      }

      throw error;
    }
  }

  async findAll(
    query: GetPersonsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PersonsPage> {
    const { page, limit, pnfl } = query;

    const builder = this.createScopedQuery(user);

    if (pnfl !== undefined) {
      builder.andWhere('person.pnfl = :filterPnfl', {
        filterPnfl: pnfl,
      });
    }

    const [data, total] = await builder
      .orderBy('person.lastName', 'ASC')
      .addOrderBy('person.firstName', 'ASC')
      .addOrderBy('person.id', 'ASC')
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

  async findOne(id: number, user: AuthenticatedUser): Promise<Person> {
    const person = await this.createScopedQuery(user)
      .leftJoinAndSelect('person.mahalla', 'residenceMahalla')
      .leftJoinAndSelect('residenceMahalla.district', 'residenceDistrict')
      .leftJoinAndSelect('residenceDistrict.region', 'residenceRegion')
      .andWhere('person.id = :personId', {
        personId: id,
      })
      .getOne();

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi');
    }

    return person;
  }

  async update(id: number, dto: UpdatePersonDto): Promise<Person> {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Shaxs ID qiymati noto‘g‘ri');
    }

    // Faqat ruxsat etilgan va yuborilgan maydonlarni olamiz.
    const changes: UpdatePersonDto = {};

    if (dto.firstName !== undefined) {
      changes.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      changes.lastName = dto.lastName;
    }

    if (dto.middleName !== undefined) {
      changes.middleName = dto.middleName;
    }

    if (dto.gender !== undefined) {
      changes.gender = dto.gender;
    }

    if (dto.nationality !== undefined) {
      changes.nationality = dto.nationality;
    }

    if (dto.birthDate !== undefined) {
      changes.birthDate = dto.birthDate;
    }

    if (dto.address !== undefined) {
      changes.address = dto.address;
    }

    if (dto.phoneNumber !== undefined) {
      changes.phoneNumber = dto.phoneNumber;
    }
    if (dto.mahallaId !== undefined) {
      await this.validateMahalla(dto.mahallaId);
      changes.mahallaId = dto.mahallaId;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'O‘zgartirish uchun kamida bitta maydon yuboring',
      );
    }

    if (changes.birthDate) {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());

      const getPart = (name: string): string =>
        parts.find((part) => part.type === name)?.value ?? '';

      const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

      if (changes.birthDate > today) {
        throw new BadRequestException(
          'Tug‘ilgan sana kelajakdagi sana bo‘lishi mumkin emas',
        );
      }
    }

    const person = await this.personsRepository.findOneBy({ id });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
    }

    await this.personsRepository.update(
      {
        id,
        deletedAt: IsNull(),
      },
      changes,
    );

    const updatedPerson = await this.personsRepository.findOneBy({
      id,
    });

    if (!updatedPerson) {
      throw new NotFoundException('Shaxs topilmadi yoki arxivlangan');
    }

    return updatedPerson;
  }
}
