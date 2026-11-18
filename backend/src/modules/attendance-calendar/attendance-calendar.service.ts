import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import { School } from '../schools/school.entity';
import { District } from '../districts/district.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import {
  AttendanceCalendarRule,
  CalendarAppliesTo,
  CalendarScopeType,
} from './attendance-calendar-rule.entity';

import { GetCalendarRulesDto } from './dto/get-calendar-rules.dto';
import { ListCalendarRulesDto } from './dto/list-calendar-rules.dto';

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

  /**
   * Dam olish va bayram kunlari: foydalanuvchiga ta’sir qiladigan
   * barcha qoidalar (respublika, viloyat, tuman, maktab) bitta
   * ro‘yxatda. Maktab tanlash shart emas.
   */
  async listRules(dto: ListCalendarRulesDto, user: AuthenticatedUser) {
    const year = dto.year ?? new Date().getUTCFullYear();

    const builder = this.rulesRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.region', 'region')
      .leftJoinAndSelect('rule.district', 'district')
      .leftJoinAndSelect('rule.school', 'school')
      .leftJoinAndSelect('school.district', 'schoolDistrict')
      .leftJoinAndSelect('rule.schoolClass', 'schoolClass')
      .leftJoin('rule.createdBy', 'createdBy')
      .addSelect([
        'createdBy.id',
        'createdBy.login',
        'createdBy.firstName',
        'createdBy.lastName',
      ])
      .where('rule.isActive = :active', { active: true })
      .andWhere('rule.startDate <= :yearEnd', { yearEnd: `${year}-12-31` })
      .andWhere('rule.endDate >= :yearStart', { yearStart: `${year}-01-01` });

    await this.applyVisibility(builder, user);

    if (dto.appliesTo !== undefined) {
      builder.andWhere('rule.appliesTo IN (:...appliesTo)', {
        appliesTo:
          dto.appliesTo === CalendarAppliesTo.BOTH
            ? [CalendarAppliesTo.BOTH]
            : [dto.appliesTo, CalendarAppliesTo.BOTH],
      });
    }

    if (dto.scopeType !== undefined) {
      builder.andWhere('rule.scopeType = :filterScope', {
        filterScope: dto.scopeType,
      });
    }

    if (dto.dayType !== undefined) {
      builder.andWhere('rule.dayType = :filterDayType', {
        filterDayType: dto.dayType,
      });
    }

    const [rows, total] = await builder
      .orderBy('rule.startDate', 'ASC')
      .addOrderBy('rule.id', 'ASC')
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getManyAndCount();

    return {
      year,
      data: rows.map((rule) => ({
        id: rule.id,
        startDate: rule.startDate,
        endDate: rule.endDate,
        dayType: rule.dayType,
        appliesTo: rule.appliesTo,
        scopeType: rule.scopeType,
        isMandatory: rule.isMandatory,
        reason: rule.reason,
        region: rule.region
          ? { id: rule.region.id, name: rule.region.name }
          : null,
        district: rule.district
          ? { id: rule.district.id, name: rule.district.name }
          : null,
        school: rule.school
          ? { id: rule.school.id, name: rule.school.name }
          : null,
        schoolClass: rule.schoolClass
          ? { id: rule.schoolClass.id, name: rule.schoolClass.name }
          : null,
        createdBy: rule.createdBy
          ? {
              id: rule.createdBy.id,
              name:
                [rule.createdBy.lastName, rule.createdBy.firstName]
                  .filter(Boolean)
                  .join(' ') || rule.createdBy.login,
            }
          : null,
        createdAt: rule.createdAt,
        canCancel: this.canCancel(rule, user),
      })),
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit),
    };
  }

  /** Foydalanuvchining hududiga ta’sir qiladigan qoidalar. */
  private async applyVisibility(
    builder: SelectQueryBuilder<AttendanceCalendarRule>,
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    let regionId: number | null = null;
    let districtId: number | null = null;
    let schoolId: number | null = null;

    switch (user.role) {
      case UserRole.REGION_ADMIN:
        regionId = user.regionId ?? null;
        break;

      case UserRole.DISTRICT_ADMIN: {
        const district = user.districtId
          ? await this.schoolsRepository.manager.findOneBy(District, {
              id: user.districtId,
            })
          : null;
        districtId = district?.id ?? null;
        regionId = district?.regionId ?? null;
        break;
      }

      case UserRole.SCHOOL_ADMIN: {
        const school = user.schoolId
          ? await this.schoolsRepository.findOne({
              where: { id: user.schoolId },
              relations: { district: true },
            })
          : null;
        schoolId = school?.id ?? null;
        districtId = school?.districtId ?? null;
        regionId = school?.district.regionId ?? null;
        break;
      }

      default:
        throw new ForbiddenException('Ruxsat yo‘q');
    }

    if (regionId === null) {
      throw new ForbiddenException('Hisobga hudud biriktirilmagan');
    }

    builder.andWhere(
      new Brackets((qb) => {
        qb.where('rule.scopeType = :visGlobal', {
          visGlobal: CalendarScopeType.GLOBAL,
        }).orWhere(
          '(rule.scopeType = :visRegion AND rule.regionId = :visRegionId)',
          {
            visRegion: CalendarScopeType.REGION,
            visRegionId: regionId,
          },
        );

        if (user.role === UserRole.REGION_ADMIN) {
          // Viloyat admini: viloyatdagi barcha tuman va maktablar.
          qb.orWhere(
            '(rule.scopeType = :visDistrict AND district.regionId = :visRegionId)',
            { visDistrict: CalendarScopeType.DISTRICT },
          ).orWhere(
            '(rule.scopeType = :visSchool AND schoolDistrict.regionId = :visRegionId)',
            { visSchool: CalendarScopeType.SCHOOL },
          );
          return;
        }

        qb.orWhere(
          '(rule.scopeType = :visDistrict AND rule.districtId = :visDistrictId)',
          {
            visDistrict: CalendarScopeType.DISTRICT,
            visDistrictId: districtId,
          },
        );

        if (user.role === UserRole.DISTRICT_ADMIN) {
          qb.orWhere(
            '(rule.scopeType = :visSchool AND school.districtId = :visDistrictId)',
            { visSchool: CalendarScopeType.SCHOOL },
          );
        } else {
          qb.orWhere(
            '(rule.scopeType = :visSchool AND rule.schoolId = :visSchoolId)',
            { visSchool: CalendarScopeType.SCHOOL, visSchoolId: schoolId },
          );
        }
      }),
    );
  }

  /** `cancelRule` bilan bir xil ruxsat qoidasi (tugmani ko‘rsatish uchun). */
  private canCancel(
    rule: AttendanceCalendarRule,
    user: AuthenticatedUser,
  ): boolean {
    if (user.role === UserRole.SUPER_ADMIN) return true;

    switch (rule.scopeType) {
      case CalendarScopeType.REGION:
        return (
          user.role === UserRole.REGION_ADMIN && user.regionId === rule.regionId
        );

      case CalendarScopeType.DISTRICT:
        return (
          (user.role === UserRole.REGION_ADMIN &&
            rule.district !== null &&
            user.regionId === rule.district.regionId) ||
          (user.role === UserRole.DISTRICT_ADMIN &&
            user.districtId === rule.districtId)
        );

      case CalendarScopeType.SCHOOL:
        return (
          rule.school !== null &&
          ((user.role === UserRole.REGION_ADMIN &&
            user.regionId === rule.school.district?.regionId) ||
            (user.role === UserRole.DISTRICT_ADMIN &&
              user.districtId === rule.school.districtId) ||
            (user.role === UserRole.SCHOOL_ADMIN &&
              user.schoolId === rule.school.id))
        );

      default:
        return false;
    }
  }
}
