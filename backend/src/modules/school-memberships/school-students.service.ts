import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { SchoolClass } from '../classes/school-class.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { Person } from '../persons/person.entity';
import { School } from '../schools/school.entity';
import { UserRole } from '../users/enums/user-role.enum';

import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { MembershipType, SchoolMembership } from './school-membership.entity';
import { birthDateValid, canCreateStudentIn } from './school-students.rules';

export interface CreatedSchoolStudent {
  person: Person;
  membership: SchoolMembership;
}

function todayInTashkent(): string {
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

@Injectable()
export class SchoolStudentsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    dto: CreateSchoolStudentDto,
    user: AuthenticatedUser,
  ): Promise<CreatedSchoolStudent> {
    let schoolId: number | undefined = dto.schoolId;

    if (user.role === UserRole.SCHOOL_ADMIN) {
      if (!user.schoolId) {
        throw new ForbiddenException('Hisobga maktab biriktirilmagan');
      }

      if (schoolId !== undefined && schoolId !== user.schoolId) {
        throw new ForbiddenException('Faqat o‘z maktabingizga qo‘sha olasiz');
      }

      schoolId = user.schoolId;
    }

    if (schoolId === undefined) {
      throw new BadRequestException('Maktabni tanlang');
    }

    const today = todayInTashkent();

    if (dto.birthDate && !birthDateValid(dto.birthDate, today)) {
      throw new BadRequestException(
        'Tug‘ilgan sana kelajakdagi sana bo‘lishi mumkin emas',
      );
    }

    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          const school = await manager.findOne(School, {
            where: { id: schoolId },
            relations: { district: true },
          });

          if (!school) {
            throw new NotFoundException('Maktab topilmadi');
          }

          const allowed = canCreateStudentIn(user, {
            id: school.id,
            districtId: school.districtId,
            regionId: school.district.regionId,
          });

          if (!allowed) {
            throw new ForbiddenException(
              'Ushbu maktabga o‘quvchi qo‘shishga ruxsat yo‘q',
            );
          }

          const mahalla = await manager.findOneBy(Mahalla, {
            id: dto.mahallaId,
            isActive: true,
          });

          if (!mahalla) {
            throw new BadRequestException(
              'Tanlangan mahalla mavjud emas yoki faol emas',
            );
          }

          const classId = dto.classId ?? null;

          if (classId !== null) {
            const schoolClass = await manager.findOneBy(SchoolClass, {
              id: classId,
              schoolId: school.id,
            });

            if (!schoolClass) {
              throw new BadRequestException(
                'Tanlangan sinf mavjud emas yoki ushbu maktabga tegishli emas',
              );
            }
          }

          const person = await manager.save(
            manager.create(Person, {
              pnfl: dto.pnfl,
              firstName: dto.firstName,
              lastName: dto.lastName,
              middleName: dto.middleName ?? null,
              gender: dto.gender ?? null,
              birthDate: dto.birthDate ?? null,
              address: dto.address ?? null,
              phoneNumber: dto.phoneNumber ?? null,
              mahallaId: dto.mahallaId,
            }),
          );

          const membership = await manager.save(
            manager.create(SchoolMembership, {
              personId: person.id,
              schoolId: school.id,
              classId,
              type: MembershipType.STUDENT,
              startDate: today,
              endDate: null,
            }),
          );

          return { person, membership };
        },
      );
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };

        if (driverError.code === 'ER_DUP_ENTRY') {
          // Boshqa maktab ma'lumotini oshkor qilmaymiz.
          throw new ConflictException(
            'Ushbu PNFL bilan shaxs allaqachon mavjud. Tuman adminiga murojaat qiling',
          );
        }
      }

      throw error;
    }
  }
}
