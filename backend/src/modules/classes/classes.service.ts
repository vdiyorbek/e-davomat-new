import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { School } from '../schools/school.entity';
import { SchoolClass } from './school-class.entity';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { ListSchoolClassesDto } from './dto/list-school-classes.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

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
}
