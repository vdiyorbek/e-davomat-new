import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { GetClassesPageQueryDto } from './dto/get-classes-page-query.dto';
import { School } from '../schools/school.entity';
import { SchoolClass } from './school-class.entity';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { ListSchoolClassesDto } from './dto/list-school-classes.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdateSchoolClassGradeDto } from './dto/update-school-class-grade.dto';

/** Sinf va maktab nomi birga, apostroflarsiz: «Qo‘rg‘on» = «Qorgon». */
const SEARCH_TEXT_SQL = ["'", '‘', '’', 'ʻ', 'ʼ', '`'].reduce(
  (sql, char) => `REPLACE(${sql}, '${char === "'" ? "''" : char}', '')`,
  "CONCAT_WS(' ', schoolClass.name, school.name)",
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
export class ClassesService {
  constructor(
    @InjectRepository(SchoolClass)
    private readonly classesRepository: Repository<SchoolClass>,

    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,
  ) {}

  async create(
    dto: CreateSchoolClassDto,
    user: AuthenticatedUser,
  ): Promise<SchoolClass> {
    const [startYear, endYear] = dto.academicYear.split('-').map(Number);

    if (endYear !== startYear + 1) {
      throw new BadRequestException(
        'O‘quv yili ketma-ket bo‘lishi kerak. Masalan: 2026-2027',
      );
    }

    const school = await this.schoolsRepository.findOne({
      where: { id: dto.schoolId },
      relations: {
        district: true,
      },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!user.regionId || school.district.regionId !== user.regionId) {
          throw new ForbiddenException(
            'Faqat o‘z viloyatingizdagi maktabda sinf yarata olasiz',
          );
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId || school.districtId !== user.districtId) {
          throw new ForbiddenException(
            'Faqat o‘z tumaningizdagi maktabda sinf yarata olasiz',
          );
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || school.id !== user.schoolId) {
          throw new ForbiddenException(
            'Faqat o‘z maktabingizda sinf yarata olasiz',
          );
        }
        break;

      default:
        throw new ForbiddenException('Sinf yaratishga ruxsat berilmagan');
    }

    const schoolClass = this.classesRepository.create({
      schoolId: school.id,
      academicYear: dto.academicYear,
      name: dto.name,
      gradeLevel: dto.gradeLevel ?? null,
    });

    try {
      return await this.classesRepository.save(schoolClass);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu maktabda shu o‘quv yili uchun bu sinf mavjud',
          );
        }

        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException('Maktab topilmadi');
        }
      }

      throw error;
    }
  }

  async findAll(
    dto: ListSchoolClassesDto,
    user: AuthenticatedUser,
  ): Promise<SchoolClass[]> {
    const [startYear, endYear] = dto.academicYear.split('-').map(Number);

    if (endYear !== startYear + 1) {
      throw new BadRequestException(
        'O‘quv yili ketma-ket bo‘lishi kerak. Masalan: 2026-2027',
      );
    }

    const school = await this.schoolsRepository.findOne({
      where: { id: dto.schoolId },
      relations: {
        district: true,
      },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!user.regionId || school.district.regionId !== user.regionId) {
          throw new ForbiddenException(
            "Ushbu maktab sinflarini ko'rishga ruxsat yo'q",
          );
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId || school.districtId !== user.districtId) {
          throw new ForbiddenException(
            'Ushbu maktab sinflarini ko‘rishga ruxsat yo‘q',
          );
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || school.id !== user.schoolId) {
          throw new ForbiddenException(
            'Faqat o‘z maktabingiz sinflarini ko‘ra olasiz',
          );
        }
        break;

      default:
        throw new ForbiddenException('Sinflarni ko‘rishga ruxsat berilmagan');
    }
    return this.classesRepository.find({
      where: {
        schoolId: dto.schoolId,
        academicYear: dto.academicYear,
      },
      order: {
        name: 'ASC',
        id: 'ASC',
      },
    });
  }

  /** Sahifalangan ro‘yxat: barcha ruxsat berilgan maktablar sinflari. */
  async findPage(query: GetClassesPageQueryDto, user: AuthenticatedUser) {
    const { page, limit, q } = query;

    if (query.academicYear) {
      const [startYear, endYear] = query.academicYear.split('-').map(Number);

      if (endYear !== startYear + 1) {
        throw new BadRequestException(
          'O‘quv yili ketma-ket bo‘lishi kerak. Masalan: 2026-2027',
        );
      }
    }

    const builder = this.classesRepository
      .createQueryBuilder('schoolClass')
      .innerJoinAndSelect('schoolClass.school', 'school')
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
        builder.andWhere('schoolClass.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException('Sinflarni ko‘rishga ruxsat berilmagan');
    }

    if (query.academicYear) {
      builder.andWhere('schoolClass.academicYear = :academicYear', {
        academicYear: query.academicYear,
      });
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

    if (query.schoolId !== undefined) {
      builder.andWhere('schoolClass.schoolId = :filterSchoolId', {
        filterSchoolId: query.schoolId,
      });
    }

    if (q) {
      const words = q
        .split(/\s+/)
        .map((word) => word.replace(/['‘’ʻʼ`]/g, ''))
        .filter(Boolean);

      words.forEach((word, index) => {
        // LIKE ichidagi %, _ va ! belgilarini oddiy matn sifatida izlaymiz.
        const escaped = word.replace(/[!%_]/g, '!$&');
        const parameterName = `searchWord${index}`;

        builder.andWhere(
          `${SEARCH_TEXT_SQL} LIKE :${parameterName} ESCAPE '!'`,
          {
            [parameterName]: `%${escaped}%`,
          },
        );
      });
    }

    // Daraja filtridan oldingi holat: shu filtrlar ichida
    // darajasi belgilanmagan sinflar soni (ogohlantirish uchun).
    const missingGrade = await builder
      .clone()
      .andWhere('schoolClass.gradeLevel IS NULL')
      .getCount();

    if (query.grade === 'NONE') {
      builder.andWhere('schoolClass.gradeLevel IS NULL');
    } else if (query.grade) {
      builder.andWhere('schoolClass.gradeLevel = :grade', {
        grade: Number(query.grade),
      });
    }

    const [classes, total] = await builder
      .orderBy('school.name', 'ASC')
      .addOrderBy('schoolClass.gradeLevel', 'ASC')
      .addOrderBy('schoolClass.name', 'ASC')
      .addOrderBy('schoolClass.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const students = await this.countStudents(classes.map((item) => item.id));

    return {
      data: classes.map((item) => ({
        id: item.id,
        schoolId: item.schoolId,
        academicYear: item.academicYear,
        name: item.name,
        gradeLevel: item.gradeLevel,
        school: item.school,
        stats: { students: students.get(item.id) ?? 0 },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      missingGrade,
    };
  }

  /** Joriy sahifadagi sinflarning faol o‘quvchilari — bitta so‘rovda. */
  private async countStudents(
    classIds: number[],
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();

    if (classIds.length === 0) {
      return result;
    }

    const today = todayInTashkent();

    const rows = await this.classesRepository.manager
      .createQueryBuilder(SchoolMembership, 'membership')
      .select('membership.classId', 'classId')
      .addSelect('COUNT(DISTINCT membership.personId)', 'students')
      .where('membership.classId IN (:...classIds)', { classIds })
      .andWhere('membership.type = :type', { type: MembershipType.STUDENT })
      .andWhere('membership.startDate <= :today', { today })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .groupBy('membership.classId')
      .getRawMany<{ classId: number | string; students: number | string }>();

    for (const row of rows) {
      result.set(Number(row.classId), Number(row.students));
    }

    return result;
  }

  async updateGradeLevel(
    id: number,
    dto: UpdateSchoolClassGradeDto,
    user: AuthenticatedUser,
  ) {
    const schoolClass = await this.classesRepository.findOne({
      where: { id },
      relations: {
        school: {
          district: true,
        },
      },
    });

    if (!schoolClass) {
      throw new NotFoundException('Sinf topilmadi');
    }

    const school = schoolClass.school;

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!user.regionId || school.district.regionId !== user.regionId) {
          throw new ForbiddenException(
            'Ushbu viloyat sinfini o‘zgartirishga ruxsat yo‘q',
          );
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId || school.districtId !== user.districtId) {
          throw new ForbiddenException(
            'Ushbu tuman sinfini o‘zgartirishga ruxsat yo‘q',
          );
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || school.id !== user.schoolId) {
          throw new ForbiddenException(
            'Faqat o‘z maktabingiz sinfini o‘zgartira olasiz',
          );
        }
        break;

      default:
        throw new ForbiddenException(
          'Sinf darajasini o‘zgartirishga ruxsat yo‘q',
        );
    }

    if (schoolClass.gradeLevel !== dto.gradeLevel) {
      await this.classesRepository.update(schoolClass.id, {
        gradeLevel: dto.gradeLevel,
      });
    }

    return {
      id: schoolClass.id,
      schoolId: schoolClass.schoolId,
      academicYear: schoolClass.academicYear,
      name: schoolClass.name,
      gradeLevel: dto.gradeLevel,
    };
  }
}
