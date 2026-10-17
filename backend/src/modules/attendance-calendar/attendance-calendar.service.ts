import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { School } from '../schools/school.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import {
  AttendanceCalendarRule,
  CalendarScopeType,
} from './attendance-calendar-rule.entity';

import { GetCalendarRulesDto } from './dto/get-calendar-rules.dto';

@Injectable()
export class AttendanceCalendarService {
  constructor(
    @InjectRepository(AttendanceCalendarRule)
    private readonly rulesRepository: Repository<AttendanceCalendarRule>,

    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,
  ) {}

  async findRules(dto: GetCalendarRulesDto, user: AuthenticatedUser) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak',
      );
    }

    const start = Date.parse(`${dto.startDate}T00:00:00Z`);
    const end = Date.parse(`${dto.endDate}T00:00:00Z`);

    if ((end - start) / 86400000 > 366) {
      throw new BadRequestException(
        'Sana oralig‘i 366 kundan oshmasligi kerak',
      );
    }

    const school = await this.schoolsRepository.findOne({
      where: { id: dto.schoolId },
      relations: { district: true },
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
            'Ushbu viloyat maktabini ko‘rishga ruxsat yo‘q',
          );
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId || school.districtId !== user.districtId) {
          throw new ForbiddenException(
            'Ushbu tuman maktabini ko‘rishga ruxsat yo‘q',
          );
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || school.id !== user.schoolId) {
          throw new ForbiddenException(
            'Faqat o‘z maktabingiz kalendarini ko‘ra olasiz',
          );
        }
        break;

      default:
        throw new ForbiddenException('Ruxsat yo‘q');
    }

    return this.rulesRepository
      .createQueryBuilder('rule')
      .where('rule.isActive = :active', {
        active: true,
      })
      .andWhere('rule.startDate <= :endDate', {
        endDate: dto.endDate,
      })
      .andWhere('rule.endDate >= :startDate', {
        startDate: dto.startDate,
      })
      .andWhere(
        new Brackets((qb) => {
          qb.where('rule.scopeType = :globalScope', {
            globalScope: CalendarScopeType.GLOBAL,
          })
            .orWhere(
              'rule.scopeType = :regionScope AND rule.regionId = :regionId',
              {
                regionScope: CalendarScopeType.REGION,
                regionId: school.district.regionId,
              },
            )
            .orWhere(
              'rule.scopeType = :districtScope AND rule.districtId = :districtId',
              {
                districtScope: CalendarScopeType.DISTRICT,
                districtId: school.districtId,
              },
            )
            .orWhere(
              'rule.scopeType = :schoolScope AND rule.schoolId = :schoolId',
              {
                schoolScope: CalendarScopeType.SCHOOL,
                schoolId: school.id,
              },
            );
        }),
      )
      .orderBy('rule.startDate', 'ASC')
      .addOrderBy('rule.id', 'ASC')
      .getMany();
  }
}
