import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { District } from '../districts/district.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/user.entity';

import { SetInspectorMahallasDto } from './dto/set-inspector-mahallas.dto';
import { InspectorMahalla } from './inspector-mahalla.entity';
import {
  MAX_MAHALLAS_PER_INSPECTOR,
  normalizeIds,
  countStatuses,
  dayStatus,
  InspectorDayStatus,
  tashkentToday,
} from './inspector.rules';
import {
  AttendanceExcuse,
  AttendanceExcuseStatus,
} from '../attendance-excuses/attendance-excuse.entity';
import {
  attendanceCalendarKey,
  CalendarResolverService,
} from '../attendance-calendar/calendar-resolver.service';
import { DailyAttendance } from '../daily-attendance/daily-attendance.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { Person } from '../persons/person.entity';
import { GetInspectorStudentsQueryDto } from './dto/get-inspector-students-query.dto';
import {} from './inspector.rules';

@Injectable()
export class InspectorsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,
    @InjectRepository(Mahalla)
    private readonly mahallasRepository: Repository<Mahalla>,
    @InjectRepository(InspectorMahalla)
    private readonly assignmentsRepository: Repository<InspectorMahalla>,
    @InjectRepository(AttendanceExcuse)
    private readonly excusesRepository: Repository<AttendanceExcuse>,
    private readonly calendarResolver: CalendarResolverService,
  ) {}

  /** Uchastkavoyga biriktirilgan mahallalar (admin ko'rinishi). */
  async getMahallas(userId: number, actor: AuthenticatedUser) {
    const inspector = await this.loadInspector(userId);
    await this.checkAdminAccess(inspector, actor);

    const rows = await this.assignmentsRepository.find({
      where: { userId },
      relations: { mahalla: true },
      order: { id: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.mahalla.id,
      name: row.mahalla.name,
      isActive: row.mahalla.isActive,
    }));
  }

  /** Biriktirilgan mahallalar ro'yxatini to'liq almashtiradi. */
  async setMahallas(
    userId: number,
    dto: SetInspectorMahallasDto,
    actor: AuthenticatedUser,
  ) {
    const inspector = await this.loadInspector(userId);
    await this.checkAdminAccess(inspector, actor);

    const ids = normalizeIds(dto.mahallaIds);

    if (ids.length > MAX_MAHALLAS_PER_INSPECTOR) {
      throw new BadRequestException(
        `Bitta uchastkavoyga ko‘pi bilan ${MAX_MAHALLAS_PER_INSPECTOR} ta mahalla biriktiriladi`,
      );
    }

    if (ids.length > 0) {
      const found = await this.mahallasRepository.find({
        where: {
          id: In(ids),
          districtId: inspector.districtId!,
          isActive: true,
        },
        select: { id: true },
      });

      if (found.length !== ids.length) {
        throw new BadRequestException(
          'Mahallalar uchastkavoy tumanida bo‘lishi va faol bo‘lishi kerak',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(InspectorMahalla, { userId });

      if (ids.length > 0) {
        await manager.insert(
          InspectorMahalla,
          ids.map((mahallaId) => ({ userId, mahallaId })),
        );
      }
    });

    return this.getMahallas(userId, actor);
  }

  /** Uchastkavoyning o'z mahallalaridagi o'quvchilar va ularning kun holati. */
  async listStudents(
    query: GetInspectorStudentsQueryDto,
    actor: AuthenticatedUser,
  ) {
    const today = tashkentToday();
    const date = query.date ?? today;

    if (date > today) {
      throw new BadRequestException('Kelajak sanasini tanlab bo‘lmaydi');
    }

    const assigned = await this.assignmentsRepository.find({
      where: { userId: actor.id },
      select: { mahallaId: true },
    });
    let mahallaIds = assigned.map((row) => row.mahallaId);

    if (query.mahallaId !== undefined) {
      if (!mahallaIds.includes(query.mahallaId)) {
        throw new ForbiddenException('Bu mahalla sizga biriktirilmagan');
      }
      mahallaIds = [query.mahallaId];
    }

    if (mahallaIds.length === 0) {
      return {
        date,
        total: 0,
        page: query.page,
        limit: query.limit,
        counts: countStatuses([]),
        items: [],
      };
    }

    const builder = this.dataSource
      .getRepository(Person)
      .createQueryBuilder('p')
      .innerJoin(
        SchoolMembership,
        'sm',
        `sm.personId = p.id
         AND sm.type = :studentType
         AND sm.startDate <= :date
         AND (sm.endDate IS NULL OR sm.endDate > :date)`,
        { studentType: MembershipType.STUDENT, date },
      )
      .innerJoin('sm.school', 's')
      .leftJoin('sm.schoolClass', 'c')
      .leftJoin(
        DailyAttendance,
        'd',
        `d.pnfl = p.pnfl
         AND d.schoolId = sm.schoolId
         AND d.date = :date
         AND d.membershipType = :studentType`,
      )
      .innerJoin('p.mahalla', 'm')
      .select('p.id', 'personId')
      .addSelect('p.pnfl', 'pnfl')
      .addSelect('p.firstName', 'firstName')
      .addSelect('p.lastName', 'lastName')
      .addSelect('p.middleName', 'middleName')
      .addSelect('m.id', 'mahallaId')
      .addSelect('m.name', 'mahallaName')
      .addSelect('s.id', 'schoolId')
      .addSelect('s.name', 'schoolName')
      .addSelect('c.id', 'classId')
      .addSelect('c.name', 'className')
      .addSelect('d.firstInTime', 'firstInTime')
      .where('p.deletedAt IS NULL')
      .andWhere('p.mahallaId IN (:...mahallaIds)', { mahallaIds })
      .orderBy('p.lastName', 'ASC')
      .addOrderBy('p.firstName', 'ASC')
      .addOrderBy('p.id', 'ASC');

    if (query.search) {
      const escaped = query.search.replace(/[!%_]/g, (char) => `!${char}`);
      builder.andWhere(
        `CONCAT_WS(' ', p.lastName, p.firstName, p.middleName) LIKE :search ESCAPE '!'`,
        { search: `%${escaped}%` },
      );
    }

    const rows = await builder.getRawMany<{
      personId: number | string;
      pnfl: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      mahallaId: number | string;
      mahallaName: string;
      schoolId: number | string;
      schoolName: string;
      classId: number | string | null;
      className: string | null;
      firstInTime: Date | null;
    }>();

    // O'quv kuni: sinf darajasida kalendar xizmatidan.
    const states = await this.calendarResolver.resolveForAttendanceDay(
      date,
      MembershipType.STUDENT,
      rows.map((row) => ({
        schoolId: Number(row.schoolId),
        classId: row.classId === null ? null : Number(row.classId),
      })),
    );

    // Shu kunni qoplaydigan faol sababnomalar.
    const personIds = [...new Set(rows.map((row) => Number(row.personId)))];
    const excuses = personIds.length
      ? await this.excusesRepository
          .createQueryBuilder('e')
          .select('e.personId', 'personId')
          .where('e.personId IN (:...personIds)', { personIds })
          .andWhere('e.status = :active', {
            active: AttendanceExcuseStatus.ACTIVE,
          })
          .andWhere('e.startDate <= :date AND e.endDate >= :date', { date })
          .getRawMany<{ personId: number | string }>()
      : [];
    const excusedIds = new Set(excuses.map((row) => Number(row.personId)));

    const all = rows.map((row) => {
      const classId = row.classId === null ? null : Number(row.classId);
      const status: InspectorDayStatus = dayStatus({
        workDay:
          states.get(attendanceCalendarKey(Number(row.schoolId), classId)) ===
          'WORK_DAY',
        excused: excusedIds.has(Number(row.personId)),
        firstIn: row.firstInTime ? new Date(row.firstInTime) : null,
      });

      return {
        personId: Number(row.personId),
        pnfl: row.pnfl,
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName,
        mahalla: { id: Number(row.mahallaId), name: row.mahallaName },
        school: { id: Number(row.schoolId), name: row.schoolName },
        schoolClass:
          classId === null ? null : { id: classId, name: row.className },
        status,
      };
    });

    // Sanoq filtrdan oldingi to'liq ro'yxat bo'yicha.
    const counts = countStatuses(all.map((item) => item.status));
    const filtered = query.status
      ? all.filter((item) => item.status === query.status)
      : all;

    const start = (query.page - 1) * query.limit;

    return {
      date,
      total: filtered.length,
      page: query.page,
      limit: query.limit,
      counts,
      items: filtered.slice(start, start + query.limit),
    };
  }

  private async loadInspector(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user || user.role !== UserRole.MAHALLA_INSPECTOR) {
      throw new NotFoundException('Uchastkavoy topilmadi');
    }

    if (user.districtId === null) {
      throw new BadRequestException('Uchastkavoyga tuman biriktirilmagan');
    }

    return user;
  }

  /** Super admin hammasiga; viloyat admini o'z viloyati, tuman admini o'z tumani uchun. */
  private async checkAdminAccess(
    inspector: User,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    if (actor.role === UserRole.DISTRICT_ADMIN) {
      if (
        actor.districtId !== null &&
        actor.districtId === inspector.districtId
      ) {
        return;
      }
      throw new ForbiddenException('Ruxsat yo‘q');
    }

    if (actor.role === UserRole.REGION_ADMIN && actor.regionId !== null) {
      const district = await this.districtsRepository.findOne({
        where: { id: inspector.districtId! },
        select: { id: true, regionId: true },
      });

      if (district && district.regionId === actor.regionId) return;
    }

    throw new ForbiddenException('Ruxsat yo‘q');
  }
}
