import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, In } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';

import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import { TerminalDirection } from '../terminals/enums/terminal-direction.enum';

import { DailyAttendance } from './daily-attendance.entity';
import { GetDailyAttendanceQueryDto } from './dto/get-daily-attendance-query.dto';

@Injectable()
export class DailyAttendanceReadService {
  constructor(private readonly dataSource: DataSource) {}

  private scopedQuery(user: AuthenticatedUser) {
    const builder = this.dataSource
      .getRepository(DailyAttendance)
      .createQueryBuilder('daily')
      .innerJoinAndSelect('daily.school', 'school')
      .innerJoinAndSelect('daily.district', 'district')
      .innerJoinAndSelect('daily.region', 'region')
      .leftJoinAndSelect('daily.firstInEvent', 'firstInEvent')
      .leftJoinAndSelect('daily.lastOutEvent', 'lastOutEvent');

    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (!user.regionId) {
          throw new ForbiddenException('Hisobga viloyat biriktirilmagan');
        }

        builder.andWhere('daily.regionId = :scopeRegionId', {
          scopeRegionId: user.regionId,
        });
        break;

      case UserRole.DISTRICT_ADMIN:
        if (!user.districtId) {
          throw new ForbiddenException('Hisobga tuman biriktirilmagan');
        }

        builder.andWhere('daily.districtId = :scopeDistrictId', {
          scopeDistrictId: user.districtId,
        });
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId) {
          throw new ForbiddenException('Hisobga maktab biriktirilmagan');
        }

        builder.andWhere('daily.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Davomat ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
    }

    return builder;
  }

  async findAll(query: GetDailyAttendanceQueryDto, user: AuthenticatedUser) {
    const builder = this.scopedQuery(user).andWhere('daily.date = :date', {
      date: query.date,
    });

    if (query.schoolId !== undefined) {
      builder.andWhere('daily.schoolId = :filterSchoolId', {
        filterSchoolId: query.schoolId,
      });
    }

    if (query.districtId !== undefined) {
      builder.andWhere('daily.districtId = :filterDistrictId', {
        filterDistrictId: query.districtId,
      });
    }

    if (query.regionId !== undefined) {
      builder.andWhere('daily.regionId = :filterRegionId', {
        filterRegionId: query.regionId,
      });
    }

    if (query.pnfl !== undefined) {
      builder.andWhere('daily.pnfl = :pnfl', {
        pnfl: query.pnfl,
      });
    }

    const [rows, total] = await builder
      .orderBy('daily.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const pnfls = [...new Set(rows.map((row) => row.pnfl))];

    const persons = pnfls.length
      ? await this.dataSource.getRepository(Person).find({
          where: {
            pnfl: In(pnfls),
          },
          select: {
            id: true,
            pnfl: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        })
      : [];

    const personsByPnfl = new Map(
      persons.map((person) => [person.pnfl, person]),
    );

    return {
      data: rows.map((row) => {
        const person = personsByPnfl.get(row.pnfl);

        const firstPhotoReady =
          row.firstInEvent?.photoStatus === EventPhotoStatus.DOWNLOADED &&
          Boolean(row.firstInEvent.photoPath);

        const lastPhotoReady =
          row.lastOutEvent?.photoStatus === EventPhotoStatus.DOWNLOADED &&
          Boolean(row.lastOutEvent.photoPath);

        return {
          id: row.id,
          date: row.date,
          pnfl: row.pnfl,

          person: person
            ? {
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                middleName: person.middleName,
              }
            : null,

          firstInTime: row.firstInTime,
          firstInEventId: row.firstInEventId,
          firstInUrl: firstPhotoReady
            ? `/api/daily-attendance/${row.id}/photos/in`
            : null,
          firstInPhotoStatus: row.firstInEvent?.photoStatus ?? null,

          lastOutTime: row.lastOutTime,
          lastOutEventId: row.lastOutEventId,
          lastOutUrl: lastPhotoReady
            ? `/api/daily-attendance/${row.id}/photos/out`
            : null,
          lastOutPhotoStatus: row.lastOutEvent?.photoStatus ?? null,

          schoolId: row.schoolId,
          districtId: row.districtId,
          regionId: row.regionId,

          school: {
            id: row.school.id,
            name: row.school.name,
          },
          district: {
            id: row.district.id,
            name: row.district.name,
          },
          region: {
            id: row.region.id,
            name: row.region.name,
          },

          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async readPhoto(
    id: string,
    direction: string,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    // bigint ID’ni Number’ga aylantirmaymiz.
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n) {
      throw new BadRequestException('Davomat identifikatori noto‘g‘ri');
    }

    if (direction !== 'in' && direction !== 'out') {
      throw new BadRequestException(
        'Rasm yo‘nalishi in yoki out bo‘lishi kerak',
      );
    }

    const row = await this.scopedQuery(user)
      .andWhere('daily.id = :id', { id })
      .getOne();

    if (!row) {
      throw new NotFoundException('Davomat yozuvi topilmadi');
    }

    const event = direction === 'in' ? row.firstInEvent : row.lastOutEvent;

    const expectedDirection =
      direction === 'in' ? TerminalDirection.IN : TerminalDirection.OUT;

    if (
      !event ||
      event.pnfl !== row.pnfl ||
      event.schoolId !== row.schoolId ||
      event.direction !== expectedDirection ||
      event.photoStatus !== EventPhotoStatus.DOWNLOADED ||
      !event.photoPath
    ) {
      throw new NotFoundException('Davomat rasmi mavjud emas');
    }

    const root = resolve(process.cwd(), 'uploads', 'attendance');
    const filePath = resolve(process.cwd(), event.photoPath);
    const relativePath = relative(root, filePath);

    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new NotFoundException('Rasm manzili noto‘g‘ri');
    }

    try {
      return await readFile(filePath);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT' || code === 'ENOTDIR') {
        throw new NotFoundException('Rasm fayli serverda topilmadi');
      }

      throw error;
    }
  }
}
