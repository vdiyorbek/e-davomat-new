import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  AttendanceExcuse,
  AttendanceExcuseStatus,
} from '../attendance-excuses/attendance-excuse.entity';

import { School } from '../schools/school.entity';
import { District } from '../districts/district.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { TerminalDirection } from '../terminals/enums/terminal-direction.enum';

import { DailyAttendance } from './daily-attendance.entity';
import { RebuildDailyAttendanceDto } from './dto/rebuild-daily-attendance.dto';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';

interface PersonDayEvents {
  firstIn: AttendanceEvent | null;
  lastOut: AttendanceEvent | null;
}

@Injectable()
export class DailyAttendanceService {
  constructor(private readonly dataSource: DataSource) {}

  async rebuild(dto: RebuildDailyAttendanceDto) {
    // Hozirgi Toshkent vaqti: UTC+05:00.
    const startAt = new Date(`${dto.date}T00:00:00+05:00`);

    if (!Number.isFinite(startAt.getTime())) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    if (startAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'Kelajak sanasi uchun davomat hisoblab bo‘lmaydi',
      );
    }

    const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Bir maktab uchun parallel qayta hisoblashlarni ketma-ket qiladi.
      const school = await manager.findOne(School, {
        where: { id: dto.schoolId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!school) {
        throw new NotFoundException('Maktab topilmadi');
      }

      const district = await manager.findOneBy(District, {
        id: school.districtId,
      });

      if (!district) {
        throw new NotFoundException('Maktabning tumani topilmadi');
      }

      const activeStudents = await manager
        .getRepository(SchoolMembership)
        .createQueryBuilder('membership')
        .innerJoin('membership.person', 'person')
        .select('person.pnfl', 'pnfl')
        .addSelect('person.id', 'personId')
        .distinct(true)
        .where('membership.schoolId = :schoolId', {
          schoolId: school.id,
        })
        .andWhere('membership.type = :type', {
          type: MembershipType.STUDENT,
        })
        .andWhere('membership.startDate <= :date', {
          date: dto.date,
        })
        .andWhere(
          '(membership.endDate IS NULL OR membership.endDate > :date)',
          { date: dto.date },
        )
        .getRawMany<{ pnfl: string; personId: string }>();

      const people = new Map<string, PersonDayEvents>();

      for (const student of activeStudents) {
        people.set(student.pnfl, {
          firstIn: null,
          lastOut: null,
        });
      }

      const events = await manager
        .getRepository(AttendanceEvent)
        .createQueryBuilder('event')
        .select(['event.id', 'event.pnfl', 'event.eventAt', 'event.direction'])
        .where('event.schoolId = :schoolId', {
          schoolId: school.id,
        })
        .andWhere('event.eventAt >= :startAt', {
          startAt,
        })
        .andWhere('event.eventAt < :endAt', {
          endAt,
        })
        .orderBy('event.eventAt', 'ASC')
        .addOrderBy('event.id', 'ASC')
        .getMany();
      let ignoredEvents = 0;

      for (const event of events) {
        const personDay = people.get(event.pnfl);

        if (!personDay) {
          ignoredEvents++;
          continue;
        }

        if (
          event.direction === TerminalDirection.IN &&
          personDay.firstIn === null
        ) {
          personDay.firstIn = event;
        }

        if (event.direction === TerminalDirection.OUT) {
          personDay.lastOut = event;
        }
      }

      const repository = manager.getRepository(DailyAttendance);

      const existingRows = await repository.find({
        where: {
          schoolId: school.id,
          date: dto.date,
        },
      });

      const existingByPnfl = new Map(
        existingRows.map((row) => [row.pnfl, row]),
      );

      let withFirstIn = 0;
      let withLastOut = 0;
      let onlyOut = 0;

      for (const [pnfl, personDay] of people) {
        const existing = existingByPnfl.get(pnfl);

        const row =
          existing ??
          repository.create({
            schoolId: school.id,
            date: dto.date,
            pnfl,
            districtId: district.id,
            regionId: district.regionId,
          });

        row.firstInTime = personDay.firstIn?.eventAt ?? null;
        row.firstInEventId = personDay.firstIn?.id ?? null;

        row.lastOutTime = personDay.lastOut?.eventAt ?? null;
        row.lastOutEventId = personDay.lastOut?.id ?? null;

        await repository.save(row);

        if (personDay.firstIn) withFirstIn++;
        if (personDay.lastOut) withLastOut++;

        if (!personDay.firstIn && personDay.lastOut) {
          onlyOut++;
        }
      }

      const activeExcuses = await manager.getRepository(AttendanceExcuse).find({
        select: {
          personId: true,
        },
        where: {
          schoolId: school.id,
          status: AttendanceExcuseStatus.ACTIVE,
          startDate: LessThanOrEqual(dto.date),
          endDate: MoreThanOrEqual(dto.date),
        },
      });

      const excusedPersonIds = new Set(
        activeExcuses.map((excuse) => excuse.personId),
      );

      let excusedStudents = 0;

      for (const student of activeStudents) {
        const personDay = people.get(student.pnfl);

        if (
          personDay &&
          personDay.firstIn === null &&
          personDay.lastOut === null &&
          excusedPersonIds.has(Number(student.personId))
        ) {
          excusedStudents++;
        }
      }

      const absentStudents =
        people.size - withFirstIn - onlyOut - excusedStudents;

      return {
        success: true,
        schoolId: school.id,
        date: dto.date,

        sourceEvents: events.length,
        ignoredEvents,

        calculatedPersons: people.size,
        totalStudents: people.size,

        arrivedStudents: withFirstIn,
        leftStudents:
          withFirstIn -
          [...people.values()].filter((day) => day.firstIn && !day.lastOut)
            .length,
        excusedStudents,
        absentStudents,

        withFirstIn,
        withLastOut,
        onlyOut,
      };
    });
  }
}
