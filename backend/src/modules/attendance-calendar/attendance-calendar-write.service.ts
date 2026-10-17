import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { SchoolClass } from '../classes/school-class.entity';
import { District } from '../districts/district.entity';
import { Region } from '../regions/region.entity';
import { School } from '../schools/school.entity';
import { UserRole } from '../users/enums/user-role.enum';

import {
  AttendanceCalendarRule,
  CalendarAppliesTo,
  CalendarScopeType,
} from './attendance-calendar-rule.entity';
import { CreateCalendarRuleDto } from './dto/create-calendar-rule.dto';

@Injectable()
export class AttendanceCalendarWriteService {
  constructor(
    @InjectRepository(AttendanceCalendarRule)
    private readonly rules: Repository<AttendanceCalendarRule>,

    @InjectRepository(Region)
    private readonly regions: Repository<Region>,

    @InjectRepository(District)
    private readonly districts: Repository<District>,

    @InjectRepository(School)
    private readonly schools: Repository<School>,

    @InjectRepository(SchoolClass)
    private readonly classes: Repository<SchoolClass>,
  ) {}

  async createRule(dto: CreateCalendarRuleDto, actor: AuthenticatedUser) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('Sanalar noto‘g‘ri');
    }

    const days =
      (Date.parse(`${dto.endDate}T00:00:00Z`) -
        Date.parse(`${dto.startDate}T00:00:00Z`)) /
        86400000 +
      1;

    if (!Number.isFinite(days) || days > 366) {
      throw new BadRequestException(
        'Sana oralig‘i 366 kundan oshmasligi kerak',
      );
    }

    const { scopeType, regionId, districtId, schoolId, classId } = dto;

    if (
      dto.isMandatory &&
      (actor.role !== UserRole.SUPER_ADMIN ||
        scopeType !== CalendarScopeType.GLOBAL)
    ) {
      throw new ForbiddenException(
        'Majburiy respublika qoidasini faqat bosh administrator yaratadi',
      );
    }

    if (
      classId != null &&
      (scopeType !== CalendarScopeType.SCHOOL ||
        dto.appliesTo !== CalendarAppliesTo.STUDENT)
    ) {
      throw new BadRequestException(
        'Sinf bo‘yicha qoida faqat SCHOOL va STUDENT uchun mumkin',
      );
    }

    switch (scopeType) {
      case CalendarScopeType.GLOBAL: {
        if (
          regionId != null ||
          districtId != null ||
          schoolId != null ||
          classId != null
        ) {
          throw new BadRequestException(
            'GLOBAL qoida uchun hudud yoki sinf ID yuborilmaydi',
          );
        }

        if (actor.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('Ruxsat yo‘q');
        }
        break;
      }

      case CalendarScopeType.REGION: {
        if (
          regionId == null ||
          districtId != null ||
          schoolId != null ||
          classId != null
        ) {
          throw new BadRequestException('REGION uchun faqat regionId kerak');
        }

        if (!(await this.regions.exist({ where: { id: regionId } }))) {
          throw new NotFoundException('Viloyat topilmadi');
        }

        if (
          actor.role !== UserRole.SUPER_ADMIN &&
          !(actor.role === UserRole.REGION_ADMIN && actor.regionId === regionId)
        ) {
          throw new ForbiddenException('Viloyat bo‘yicha ruxsat yo‘q');
        }
        break;
      }

      case CalendarScopeType.DISTRICT: {
        if (
          districtId == null ||
          regionId != null ||
          schoolId != null ||
          classId != null
        ) {
          throw new BadRequestException(
            'DISTRICT uchun faqat districtId kerak',
          );
        }

        const district = await this.districts.findOneBy({
          id: districtId,
        });

        if (!district) {
          throw new NotFoundException('Tuman topilmadi');
        }

        const allowed =
          actor.role === UserRole.SUPER_ADMIN ||
          (actor.role === UserRole.REGION_ADMIN &&
            actor.regionId === district.regionId) ||
          (actor.role === UserRole.DISTRICT_ADMIN &&
            actor.districtId === district.id);

        if (!allowed) {
          throw new ForbiddenException('Tuman bo‘yicha ruxsat yo‘q');
        }
        break;
      }

      case CalendarScopeType.SCHOOL: {
        if (schoolId == null || regionId != null || districtId != null) {
          throw new BadRequestException('SCHOOL uchun schoolId kerak');
        }

        const school = await this.schools.findOne({
          where: { id: schoolId },
          relations: { district: true },
        });

        if (!school) {
          throw new NotFoundException('Maktab topilmadi');
        }

        const allowed =
          actor.role === UserRole.SUPER_ADMIN ||
          (actor.role === UserRole.REGION_ADMIN &&
            actor.regionId === school.district.regionId) ||
          (actor.role === UserRole.DISTRICT_ADMIN &&
            actor.districtId === school.districtId) ||
          (actor.role === UserRole.SCHOOL_ADMIN &&
            actor.schoolId === school.id);

        if (!allowed) {
          throw new ForbiddenException('Maktab bo‘yicha ruxsat yo‘q');
        }

        if (classId != null) {
          const schoolClass = await this.classes.findOneBy({
            id: classId,
            schoolId,
          });

          if (!schoolClass) {
            throw new BadRequestException('Sinf ushbu maktabga tegishli emas');
          }
        }
        break;
      }

      default:
        throw new BadRequestException('Qoida hududi noto‘g‘ri');
    }

    // Sana oralig‘i ustma-ust tushgan faol qoidalarni tekshiramiz.
    const existingRules = await this.rules
      .createQueryBuilder('rule')
      .where('rule.isActive = :active', { active: true })
      .andWhere('rule.startDate <= :endDate', {
        endDate: dto.endDate,
      })
      .andWhere('rule.endDate >= :startDate', {
        startDate: dto.startDate,
      })
      .getMany();

    for (const rule of existingRules) {
      const audienceOverlaps =
        rule.appliesTo === CalendarAppliesTo.BOTH ||
        dto.appliesTo === CalendarAppliesTo.BOTH ||
        rule.appliesTo === dto.appliesTo;

      if (!audienceOverlaps) continue;

      const sameScope =
        rule.scopeType === scopeType &&
        (scopeType === CalendarScopeType.GLOBAL ||
          (scopeType === CalendarScopeType.REGION &&
            rule.regionId === regionId) ||
          (scopeType === CalendarScopeType.DISTRICT &&
            rule.districtId === districtId) ||
          (scopeType === CalendarScopeType.SCHOOL &&
            rule.schoolId === schoolId));

      const classesOverlap =
        scopeType !== CalendarScopeType.SCHOOL ||
        rule.classId == null ||
        classId == null ||
        rule.classId === classId;

      if (sameScope && classesOverlap) {
        throw new ConflictException(
          `Shu hudud va sanada ${rule.id}-raqamli qoida mavjud`,
        );
      }

      const mandatoryConflict =
        rule.dayType !== dto.dayType &&
        ((rule.scopeType === CalendarScopeType.GLOBAL && rule.isMandatory) ||
          (scopeType === CalendarScopeType.GLOBAL && dto.isMandatory === true));

      if (mandatoryConflict) {
        throw new ConflictException(
          'Majburiy respublika qoidasiga zid sana mavjud',
        );
      }
    }

    const entity = this.rules.create({
      startDate: dto.startDate,
      endDate: dto.endDate,
      dayType: dto.dayType,
      appliesTo: dto.appliesTo,
      scopeType,

      regionId: regionId ?? null,
      districtId: districtId ?? null,
      schoolId: schoolId ?? null,
      classId: classId ?? null,

      isMandatory: dto.isMandatory ?? false,
      isActive: true,
      reason: dto.reason,

      createdByUserId: actor.id,
      updatedByUserId: null,
    });

    return this.rules.save(entity);
  }
}
