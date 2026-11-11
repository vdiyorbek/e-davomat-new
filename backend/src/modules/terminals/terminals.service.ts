import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  getTerminalHealthStatus,
  healthSqlParams,
  healthStatusSql,
  syncDelayedSql,
} from './terminal-health.rules';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { School } from '../schools/school.entity';
import {
  MembershipType,
  SchoolMembership,
} from '../school-memberships/school-membership.entity';
import { Terminal } from './terminal.entity';
import { TerminalCryptoService } from './terminal-crypto.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { GetTerminalsQueryDto } from './dto/get-terminals-query.dto';
import { HikvisionService } from './hikvision.service';
import type { HikvisionDeviceInfo } from './hikvision.service';
import { StartTerminalSyncDto } from './dto/start-terminal-sync.dto';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

@Injectable()
export class TerminalsService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,

    @InjectRepository(SchoolMembership)
    private readonly schoolMembershipsRepository: Repository<SchoolMembership>,

    private readonly terminalCrypto: TerminalCryptoService,

    private readonly hikvision: HikvisionService,
  ) {}

  async create(dto: CreateTerminalDto) {
    const school = await this.schoolsRepository.findOne({
      where: { id: dto.schoolId },
      relations: {
        district: {
          region: true,
        },
      },
    });

    if (!school) {
      throw new NotFoundException('Maktab topilmadi');
    }

    const terminal = this.terminalsRepository.create({
      name: dto.name,
      schoolId: school.id,
      direction: dto.direction,
      protocol: dto.protocol,
      host: this.normalizeHost(dto.host),
      port: dto.port,
      username: dto.username,
      passwordEncrypted: this.terminalCrypto.encrypt(dto.password),
      isActive: dto.isActive ?? true,
      model: null,
      serialNumber: null,
      lastCheckedAt: null,
      lastSuccessfulSyncAt: null,
      syncStartAt: null,
      eventsSyncedUntil: null,
    });

    try {
      const saved = await this.terminalsRepository.save(terminal);

      saved.school = school;

      return this.toResponse(saved);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu IP manzil va port bilan terminal allaqachon mavjud',
          );
        }

        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException('Maktab topilmadi');
        }
      }

      throw error;
    }
  }

  async update(id: number, dto: UpdateTerminalDto) {
    const terminal = await this.terminalsRepository.findOne({
      where: { id },
      relations: {
        school: {
          district: {
            region: true,
          },
        },
      },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }
    if (terminal.archivedAt) {
      throw new ConflictException(
        'Arxivlangan terminalni tahrirlash mumkin emas',
      );
    }

    if (dto.name !== undefined) {
      terminal.name = dto.name;
    }

    if (dto.direction !== undefined) {
      terminal.direction = dto.direction;
    }

    if (dto.protocol !== undefined) {
      terminal.protocol = dto.protocol;
    }

    if (dto.host !== undefined) {
      terminal.host = this.normalizeHost(dto.host);
    }

    if (dto.port !== undefined) {
      terminal.port = dto.port;
    }

    if (dto.username !== undefined) {
      terminal.username = dto.username;
    }

    if (dto.password !== undefined) {
      terminal.passwordEncrypted = this.terminalCrypto.encrypt(dto.password);
    }

    if (dto.isActive !== undefined) {
      terminal.isActive = dto.isActive;
    }

    try {
      const saved = await this.terminalsRepository.save(terminal);

      return this.toResponse(saved);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu IP manzil va port boshqa terminalda mavjud',
          );
        }
      }

      throw error;
    }
  }

  async archive(id: number) {
    const terminal = await this.terminalsRepository.findOne({
      where: { id },
      relations: {
        school: {
          district: {
            region: true,
          },
        },
      },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (terminal.archivedAt) {
      throw new ConflictException('Terminal allaqachon arxivlangan');
    }

    terminal.isActive = false;
    terminal.archivedAt = new Date();

    const saved = await this.terminalsRepository.save(terminal);

    return {
      success: true,
      message: 'Terminal arxivlandi',
      terminalId: saved.id,
      archivedAt: saved.archivedAt,
    };
  }

  async restore(id: number) {
    const terminal = await this.terminalsRepository.findOne({
      where: { id },
      relations: {
        school: {
          district: {
            region: true,
          },
        },
      },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.archivedAt) {
      throw new ConflictException('Terminal arxivda emas');
    }

    // Arxivdan chiqaramiz, lekin avtomatik ishga tushirmaymiz.
    // Super Admin ulanishni tekshirgach faollashtirishi mumkin.
    terminal.archivedAt = null;
    terminal.isActive = false;

    const saved = await this.terminalsRepository.save(terminal);

    return {
      success: true,
      message: 'Terminal arxivdan tiklandi',
      terminalId: saved.id,
      isActive: saved.isActive,
      archivedAt: saved.archivedAt,
    };
  }

  private buildFilteredQuery(
    query: GetTerminalsQueryDto,
    user: AuthenticatedUser,
    withStatusFilters = true,
  ) {
    const builder = this.terminalsRepository
      .createQueryBuilder('terminal')
      .innerJoinAndSelect('terminal.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .innerJoinAndSelect('district.region', 'region');

    const archiveStatus = query.archiveStatus ?? 'ACTIVE';

    if (archiveStatus === 'ACTIVE') {
      builder.andWhere('terminal.archivedAt IS NULL');
    }

    if (archiveStatus === 'ARCHIVED') {
      builder.andWhere('terminal.archivedAt IS NOT NULL');
    }

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

        builder.andWhere('terminal.schoolId = :scopeSchoolId', {
          scopeSchoolId: user.schoolId,
        });
        break;

      default:
        throw new ForbiddenException(
          'Terminallar ro‘yxatini ko‘rishga ruxsat yo‘q',
        );
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
      builder.andWhere('terminal.schoolId = :filterSchoolId', {
        filterSchoolId: query.schoolId,
      });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;

      builder.andWhere(
        `(
      terminal.name LIKE :search
      OR terminal.host LIKE :search
      OR terminal.model LIKE :search
      OR school.name LIKE :search
      OR CAST(terminal.id AS CHAR) = :exactId
    )`,
        {
          search,
          exactId: query.search.trim(),
        },
      );
    }

    if (query.direction !== undefined) {
      builder.andWhere('terminal.direction = :filterDirection', {
        filterDirection: query.direction,
      });
    }
    if (withStatusFilters && query.healthStatus !== undefined) {
      builder.andWhere(`${healthStatusSql('terminal')} = :filterHealthStatus`, {
        ...healthSqlParams(),
        filterHealthStatus: query.healthStatus,
      });
    }

    if (withStatusFilters && query.syncStatus === 'DELAYED') {
      builder.andWhere(syncDelayedSql('terminal'), healthSqlParams());
    }

    return builder;
  }

  async findAll(query: GetTerminalsQueryDto, user: AuthenticatedUser) {
    const builder = this.buildFilteredQuery(query, user);
    const [terminals, total] = await builder
      .orderBy('terminal.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      data: terminals.map((terminal) => this.toResponse(terminal)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
  /**
   * Filtr bo‘yicha BARCHA terminallar holati (KPI kartalari uchun).
   * Bitta SQL so‘rov: terminallarning o‘zi yuklanmaydi, faqat sonlar.
   */
  async summary(query: GetTerminalsQueryDto, user: AuthenticatedUser) {
    const health = healthStatusSql('terminal');

    const row = await this.buildFilteredQuery(query, user, false)
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(${health} = 'ONLINE')`, 'online')
      .addSelect(`SUM(${health} = 'OFFLINE')`, 'offline')
      .addSelect(`SUM(${health} = 'UNKNOWN')`, 'unknown')
      .addSelect(`SUM(${health} = 'DISABLED')`, 'disabled')
      .addSelect(`SUM(${health} = 'ARCHIVED')`, 'archived')
      .addSelect(`SUM(${syncDelayedSql('terminal')})`, 'syncDelayed')
      .setParameters(healthSqlParams())
      .getRawOne<Record<string, string | number | null>>();

    const count = (key: string) => Number(row?.[key] ?? 0);

    return {
      total: count('total'),
      online: count('online'),
      offline: count('offline'),
      unknown: count('unknown'),
      disabled: count('disabled'),
      archived: count('archived'),
      syncDelayed: count('syncDelayed'),
      checkedAt: new Date().toISOString(),
    };
  }

  async monitoring(query: GetTerminalsQueryDto, user: AuthenticatedUser) {
    // Mavjud hududiy huquqlar va sahifalashni saqlaymiz.
    const result = await this.findAll(query, user);

    // Toshkent vaqti bo‘yicha bugungi sana.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const date = query.date ?? today;

    const terminalIds = result.data.map((terminal) => terminal.id);

    const eventStats = await this.getMonitoringEventStats(terminalIds, date);

    const now = Date.now();

    const data = result.data.map((terminal) => {
      const stats = eventStats.get(terminal.id) ?? {
        totalEvents: 0,
        repeatedEvents: 0,
        repeatedPercent: 0,
      };
      const syncedUntil = terminal.eventsSyncedUntil
        ? new Date(terminal.eventsSyncedUntil).getTime()
        : null;

      const syncDelaySeconds =
        syncedUntil !== null
          ? Math.max(0, Math.floor((now - syncedUntil) / 1000))
          : null;

      let syncStatus: 'DISABLED' | 'NOT_STARTED' | 'HEALTHY' | 'DELAYED';

      if (!terminal.isActive) {
        syncStatus = 'DISABLED';
      } else if (syncedUntil === null) {
        syncStatus = 'NOT_STARTED';
      } else if (syncDelaySeconds !== null && syncDelaySeconds <= 600) {
        syncStatus = 'HEALTHY';
      } else {
        syncStatus = 'DELAYED';
      }

      return {
        id: terminal.id,
        name: terminal.name,
        school: terminal.school,
        direction: terminal.direction,
        isActive: terminal.isActive,
        model: terminal.model,
        totalEvents: stats.totalEvents,
        repeatedEvents: stats.repeatedEvents,
        repeatedPercent: stats.repeatedPercent,
        lastCheckedAt: terminal.lastCheckedAt,
        lastSuccessfulSyncAt: terminal.lastSuccessfulSyncAt,
        eventsSyncedUntil: terminal.eventsSyncedUntil,

        syncDelaySeconds,
        syncStatus,
      };
    });

    return {
      data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      date,
      checkedAt: new Date().toISOString(),
    };
  }

  private normalizeHost(host: string): string {
    if (host.includes(':')) {
      // IPv6 manzilini yagona yozilish ko‘rinishiga keltiramiz.
      const normalized = new URL(`http://[${host}]/`).hostname;

      return normalized.slice(1, -1).toLowerCase();
    }

    return host;
  }

  private toResponse(terminal: Terminal) {
    // Faqat ruxsat etilgan maydonlarni javobga chiqaramiz.
    return {
      id: terminal.id,
      name: terminal.name,
      schoolId: terminal.schoolId,
      direction: terminal.direction,
      protocol: terminal.protocol,
      host: terminal.host,
      port: terminal.port,
      username: terminal.username,
      isActive: terminal.isActive,
      model: terminal.model,
      serialNumber: terminal.serialNumber,
      archivedAt: terminal.archivedAt,
      healthStatus: getTerminalHealthStatus(terminal),
      lastSeenAt: terminal.lastSeenAt,
      lastError: terminal.lastError,
      consecutiveFailures: terminal.consecutiveFailures,
      lastCheckedAt: terminal.lastCheckedAt,
      lastSuccessfulSyncAt: terminal.lastSuccessfulSyncAt,
      syncStartAt: terminal.syncStartAt,
      eventsSyncedUntil: terminal.eventsSyncedUntil,
      createdAt: terminal.createdAt,
      updatedAt: terminal.updatedAt,

      school: {
        id: terminal.school.id,
        name: terminal.school.name,

        district: {
          id: terminal.school.district.id,
          name: terminal.school.district.name,
        },

        region: {
          id: terminal.school.district.region.id,
          name: terminal.school.district.region.name,
        },
      },
    };
  }

  private async getMonitoringEventStats(terminalIds: number[], date: string) {
    if (terminalIds.length === 0) {
      return new Map<
        number,
        {
          totalEvents: number;
          repeatedEvents: number;
          repeatedPercent: number;
        }
      >();
    }

    const start = new Date(`${date}T00:00:00+05:00`);

    if (!Number.isFinite(start.getTime())) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // Parametrlar orqali xavfsiz SQL.
    const placeholders = terminalIds.map(() => '?').join(',');

    const sql = `
      WITH ordered_events AS (
        SELECT
          terminalId,
          eventAt,
          LAG(eventAt) OVER (
            PARTITION BY terminalId, pnfl, direction
            ORDER BY eventAt, id
          ) AS previousEventAt
        FROM attendance_events
        WHERE terminalId IN (${placeholders})
          AND eventAt >= ?
          AND eventAt < ?
      )
      SELECT
        terminalId,
        COUNT(*) AS totalEvents,
        SUM(
          CASE
            WHEN previousEventAt IS NOT NULL
             AND TIMESTAMPDIFF(
               MICROSECOND,
               previousEventAt,
               eventAt
             ) <= 5000000
            THEN 1
            ELSE 0
          END
        ) AS repeatedEvents
      FROM ordered_events
      GROUP BY terminalId
    `;

    const rows = (await this.terminalsRepository.manager.query(sql, [
      ...terminalIds,
      start,
      end,
    ])) as Array<{
      terminalId: number | string;
      totalEvents: number | string;
      repeatedEvents: number | string;
    }>;

    const stats = new Map<
      number,
      {
        totalEvents: number;
        repeatedEvents: number;
        repeatedPercent: number;
      }
    >();

    for (const row of rows) {
      const totalEvents = Number(row.totalEvents);
      const repeatedEvents = Number(row.repeatedEvents);

      stats.set(Number(row.terminalId), {
        totalEvents,
        repeatedEvents,
        repeatedPercent:
          totalEvents > 0
            ? Math.round((repeatedEvents / totalEvents) * 10000) / 100
            : 0,
      });
    }

    return stats;
  }

  private async prepareTerminalFacePhoto(filePath: string): Promise<Buffer> {
    const metadata = await sharp(filePath, {
      limitInputPixels: 25_000_000,
      failOn: 'warning',
    }).metadata();

    if (metadata.format !== 'jpeg' || (metadata.pages ?? 1) !== 1) {
      throw new Error('Manba rasm JPEG formatida emas');
    }

    const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);

    const width = rotated ? metadata.height : metadata.width;

    const height = rotated ? metadata.width : metadata.height;

    if (
      !width ||
      !height ||
      Math.min(width, height) < 480 ||
      Math.max(width, height) < 640
    ) {
      throw new Error('Manba rasmning o‘lchami yetarli emas');
    }

    const portrait = height > width;

    const targetWidth = portrait ? 480 : 640;
    const targetHeight = portrait ? 640 : 480;

    const maxBytes = 199 * 1024;

    for (const quality of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
      const buffer = await sharp(filePath, {
        limitInputPixels: 25_000_000,
        failOn: 'warning',
      })
        .rotate()
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: '#ffffff',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({
          quality,
          progressive: false,
          mozjpeg: true,
        })
        .toBuffer();

      if (buffer.length <= maxBytes) {
        // Tayyorlangan JPEG haqiqatan ochilishini
        // tekshiramiz.
        await sharp(buffer, {
          failOn: 'warning',
        })
          .raw()
          .toBuffer();

        return buffer;
      }
    }

    throw new Error('Rasmni 200 KB dan kichik formatga moslab bo‘lmadi');
  }

  async checkConnection(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :id', { id })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    let info: HikvisionDeviceInfo | null = null;
    let message = '';

    try {
      const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

      info = await this.hikvision.getDeviceInfo(terminal, password);
    } catch (error: unknown) {
      message =
        error instanceof Error
          ? error.message
          : 'Terminalni tekshirishda xatolik yuz berdi';
    }

    const checkedAt = new Date();

    if (!info) {
      await this.terminalsRepository.update(id, {
        lastCheckedAt: checkedAt,
        lastError: message.slice(0, 255),
        consecutiveFailures: () => '`consecutiveFailures` + 1',
      });

      return {
        success: false,
        terminalId: id,
        checkedAt,
        message,
      };
    }

    await this.terminalsRepository.update(id, {
      model: info.model,
      serialNumber: info.serialNumber,
      lastCheckedAt: checkedAt,
      lastSeenAt: checkedAt,
      lastError: null,
      consecutiveFailures: 0,
    });

    return {
      success: true,
      terminalId: id,
      checkedAt,
      message: 'Terminalga ulanish muvaffaqiyatli',
      model: info.model,
      serialNumber: info.serialNumber,
      firmwareVersion: info.firmwareVersion,
    };
  }

  async startSync(id: number, dto: StartTerminalSyncDto) {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const startAt = new Date(dto.startTime);

    if (!Number.isFinite(startAt.getTime()) || startAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'Boshlanish vaqti haqiqiy sana bo‘lishi va kelajakda bo‘lmasligi kerak',
      );
    }

    const terminal = await this.terminalsRepository.findOneBy({
      id,
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      throw new BadRequestException(
        'Sinxronlashni boshlash uchun terminal faol bo‘lishi kerak',
      );
    }

    if (terminal.syncStartAt !== null || terminal.eventsSyncedUntil !== null) {
      throw new ConflictException(
        'Terminalning sinxronlash boshlanish vaqti avval belgilangan',
      );
    }

    // Parallel so‘rovlar boshlanish vaqtini qayta yozib yubormaydi.
    const result = await this.terminalsRepository
      .createQueryBuilder()
      .update()
      .set({
        syncStartAt: startAt,
      })
      .where('id = :id', { id })
      .andWhere('isActive = :active', { active: true })
      .andWhere('syncStartAt IS NULL')
      .andWhere('eventsSyncedUntil IS NULL')
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException(
        'Terminal holati o‘zgargan. Ma’lumotlarni yangilang',
      );
    }

    return {
      terminalId: id,
      syncStartAt: startAt,
      eventsSyncedUntil: null,
      message: 'Avtomatik sinxronlashning boshlanish vaqti saqlandi',
    };
  }

  async getTerminalTime(id: number, user: AuthenticatedUser) {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .innerJoinAndSelect('terminal.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .where('terminal.id = :id', { id })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    // Hududiy vakolatlarni tekshiramiz.
    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.REGION_ADMIN &&
        user.regionId !== null &&
        user.regionId === terminal.school.district.regionId) ||
      (user.role === UserRole.DISTRICT_ADMIN &&
        user.districtId !== null &&
        user.districtId === terminal.school.districtId) ||
      (user.role === UserRole.SCHOOL_ADMIN &&
        user.schoolId !== null &&
        user.schoolId === terminal.schoolId);

    if (!allowed) {
      throw new ForbiddenException('Ushbu terminalni ko‘rishga ruxsat yo‘q');
    }

    let password: string;

    try {
      password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);
    } catch {
      throw new BadRequestException('Terminal parolini ochib bo‘lmadi');
    }

    const timeInfo = await this.hikvision.getDeviceTime(terminal, password);

    return {
      success: true,
      ...timeInfo,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
    };
  }

  async syncTerminalTime(id: number, user: AuthenticatedUser) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Terminal vaqtini faqat SUPER_ADMIN sinxronlay oladi',
      );
    }

    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :id', { id })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      throw new BadRequestException(
        'Faol bo‘lmagan terminal vaqti sinxronlanmaydi',
      );
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const result = await this.hikvision.syncDeviceTime(terminal, password);

    return {
      success: result.verified,
      ...result,
      message: result.verified
        ? 'Terminal vaqti server bilan moslashtirildi'
        : 'Buyruq qabul qilindi, lekin vaqt mosligi tasdiqlanmadi',
    };
  }

  async getPersonSyncPreview(terminalId: number, user: AuthenticatedUser) {
    if (
      !Number.isInteger(terminalId) ||
      terminalId < 1 ||
      terminalId > 4294967295
    ) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .innerJoinAndSelect('terminal.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.REGION_ADMIN &&
        user.regionId !== null &&
        user.regionId === terminal.school.district.regionId) ||
      (user.role === UserRole.DISTRICT_ADMIN &&
        user.districtId !== null &&
        user.districtId === terminal.school.districtId) ||
      (user.role === UserRole.SCHOOL_ADMIN &&
        user.schoolId !== null &&
        user.schoolId === terminal.schoolId);

    if (!allowed) {
      throw new ForbiddenException(
        'Ushbu terminal ma’lumotlarini ko‘rishga ruxsat yo‘q',
      );
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';

    const today = `${part('year')}-${part('month')}-${part('day')}`;

    const rows = await this.schoolMembershipsRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.person', 'person')
      .select('membership.type', 'type')
      .addSelect('COUNT(DISTINCT person.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT CASE
          WHEN person.photoUrl IS NOT NULL
           AND TRIM(person.photoUrl) <> ''
          THEN person.id
        END)`,
        'withPhoto',
      )
      .where('membership.schoolId = :schoolId', {
        schoolId: terminal.schoolId,
      })
      .andWhere('membership.startDate <= :today', { today })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('person.deletedAt IS NULL')
      .andWhere('membership.type IN (:...types)', {
        types: ['STUDENT', 'TEACHER'],
      })
      .groupBy('membership.type')
      .getRawMany<{
        type: string;
        total: string;
        withPhoto: string;
      }>();

    const result = {
      STUDENT: { total: 0, withPhoto: 0, withoutPhoto: 0 },
      TEACHER: { total: 0, withPhoto: 0, withoutPhoto: 0 },
    };

    for (const row of rows) {
      if (row.type !== 'STUDENT' && row.type !== 'TEACHER') {
        continue;
      }

      const total = Number(row.total);
      const withPhoto = Number(row.withPhoto);

      result[row.type] = {
        total,
        withPhoto,
        withoutPhoto: total - withPhoto,
      };
    }

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      date: today,
      students: result.STUDENT,
      teachers: result.TEACHER,
      summary: {
        total: result.STUDENT.total + result.TEACHER.total,
        withPhoto: result.STUDENT.withPhoto + result.TEACHER.withPhoto,
        withoutPhoto: result.STUDENT.withoutPhoto + result.TEACHER.withoutPhoto,
      },
      note: 'Rasm mavjudligi faqat photoUrl maydoni asosida tekshirildi',
    };
  }

  async getTerminalPersonsCount(id: number, user: AuthenticatedUser) {
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      throw new BadRequestException('Terminal identifikatori noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .innerJoinAndSelect('terminal.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .where('terminal.id = :id', { id })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.REGION_ADMIN &&
        user.regionId != null &&
        user.regionId === terminal.school.district.regionId) ||
      (user.role === UserRole.DISTRICT_ADMIN &&
        user.districtId != null &&
        user.districtId === terminal.school.districtId) ||
      (user.role === UserRole.SCHOOL_ADMIN &&
        user.schoolId != null &&
        user.schoolId === terminal.schoolId);

    if (!allowed) {
      throw new ForbiddenException(
        'Ushbu terminal ma’lumotlarini ko‘rishga ruxsat yo‘q',
      );
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const registeredPersons = await this.hikvision.getRegisteredPersonsCount(
      terminal,
      password,
    );

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      registeredPersons,
      checkedAt: new Date().toISOString(),
    };
  }

  async compareTerminalPersons(terminalId: number, user: AuthenticatedUser) {
    // Mavjud metod orqali terminalning mavjudligi
    // va administratorning hududiy vakolatini tekshiramiz.
    const preview = await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    // Terminaldagi barcha employeeNo qiymatlarini olamiz.
    const terminalUsers = await this.hikvision.getAllTerminalUsers(
      terminal,
      password,
    );

    // Toshkent bo‘yicha bugungi sana.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';

    const today = `${part('year')}-${part('month')}-${part('day')}`;

    // Ushbu maktabning faol shaxslarini olamiz.
    const persons = await this.schoolMembershipsRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.person', 'person')
      .select('DISTINCT person.pnfl', 'pnfl')
      .where('membership.schoolId = :schoolId', {
        schoolId: terminal.schoolId,
      })
      .andWhere('membership.startDate <= :today', {
        today,
      })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('person.deletedAt IS NULL')
      .andWhere('membership.type IN (:...types)', {
        types: [MembershipType.STUDENT, MembershipType.TEACHER],
      })
      .getRawMany<{ pnfl: string }>();

    const databasePnfls = new Set(persons.map((person) => person.pnfl));

    const terminalEmployeeNos = new Set(
      terminalUsers.map((person) => person.employeeNo),
    );

    let matched = 0;
    let missingOnTerminal = 0;
    let extraOnTerminal = 0;
    let invalidEmployeeNo = 0;

    // E-Davomatda mavjud, terminalda yo‘q shaxslar.
    for (const pnfl of databasePnfls) {
      if (terminalEmployeeNos.has(pnfl)) {
        matched++;
      } else {
        missingOnTerminal++;
      }
    }

    // Terminaldagi, bazada mos kelmaydigan yozuvlar.
    for (const employeeNo of terminalEmployeeNos) {
      if (!/^\d{14}$/.test(employeeNo)) {
        invalidEmployeeNo++;
      } else if (!databasePnfls.has(employeeNo)) {
        extraOnTerminal++;
      }
    }

    return {
      terminalId: terminal.id,
      terminalName: preview.terminalName,
      schoolId: terminal.schoolId,
      comparedAt: new Date().toISOString(),
      databasePersons: databasePnfls.size,
      terminalPersons: terminalUsers.length,
      matched,
      missingOnTerminal,
      extraOnTerminal,
      invalidEmployeeNo,
      note: 'Solishtirish faqat PNFL va employeeNo bo‘yicha bajarildi. Rasmlar hali tekshirilmagan.',
    };
  }

  async getTerminalPersonCapacity(terminalId: number, user: AuthenticatedUser) {
    // Terminal mavjudligini va hududiy vakolatni
    // oldingi metod orqali tekshiramiz.
    const preview = await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    // Hikvision qurilmasining imkoniyatlarini olamiz.
    const capacity = await this.hikvision.getUserCapacity(terminal, password);

    // Qurilmadagi mavjud foydalanuvchilar soni.
    const registeredPersons = await this.hikvision.getRegisteredPersonsCount(
      terminal,
      password,
    );

    const availableSlots =
      capacity.maxPersons !== null
        ? Math.max(0, capacity.maxPersons - registeredPersons)
        : null;

    const requiredPersons = preview.summary.total;

    return {
      terminalId: terminal.id,
      terminalName: preview.terminalName,
      schoolId: terminal.schoolId,

      databasePersons: requiredPersons,
      registeredPersons,

      maxPersons: capacity.maxPersons,
      availableSlots,

      // Bu faqat umumiy sonlar farqi.
      // Haqiqiy yetishmayotganlar compare API
      // orqali aniqlanadi.
      countDifference: requiredPersons - registeredPersons,

      capacitySufficient:
        capacity.maxPersons !== null
          ? capacity.maxPersons >= requiredPersons
          : null,

      checkedAt: new Date().toISOString(),
    };
  }

  async getTerminalFaceCount(terminalId: number, user: AuthenticatedUser) {
    // Mavjud metod orqali terminalning mavjudligi
    // va administratorning hududiy vakolatini tekshiramiz.
    await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const result = await this.hikvision.getFaceRecordsCount(terminal, password);

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      supported: result.supported,
      faceRecords: result.faceRecords,
      responseFields: result.responseFields,
      recordFields: result.recordFields,
      checkedAt: new Date().toISOString(),
    };
  }

  async checkMissingPersonsPhotos(terminalId: number, user: AuthenticatedUser) {
    // Terminalni ko‘rishga vakolat borligini tekshiramiz.
    await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const terminalUsers = await this.hikvision.getAllTerminalUsers(
      terminal,
      password,
    );

    const existing = new Set(terminalUsers.map((item) => item.employeeNo));

    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const part = (type: string) =>
      dateParts.find((p) => p.type === type)?.value ?? '';

    const today = `${part('year')}-${part('month')}-${part('day')}`;

    const persons = await this.schoolMembershipsRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.person', 'person')
      .select('person.id', 'id')
      .addSelect('person.pnfl', 'pnfl')
      .addSelect('person.photoUrl', 'photoUrl')
      .distinct(true)
      .where('membership.schoolId = :schoolId', {
        schoolId: terminal.schoolId,
      })
      .andWhere('membership.startDate <= :today', { today })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('person.deletedAt IS NULL')
      .andWhere('membership.type IN (:...types)', {
        types: ['STUDENT', 'TEACHER'],
      })
      .getRawMany<{
        id: number;
        pnfl: string;
        photoUrl: string | null;
      }>();

    const missing = persons.filter((person) => !existing.has(person.pnfl));

    const summary = {
      totalMissing: missing.length,
      ready: 0,
      noPhotoUrl: 0,
      invalidPhotoUrl: 0,
      fileNotFound: 0,
      invalidImage: 0,
      convertible: 0,
      conversionFailed: 0,
      emptyFile: 0,
      oversizedFile: 0,
      wrongFormat: 0,
      wrongDimensions: 0,
      decodeError: 0,
      dimensions: {} as Record<string, number>,
    };

    const photoDirectory = join(process.cwd(), 'uploads', 'persons');

    for (const person of missing) {
      if (!person.photoUrl) {
        summary.noPhotoUrl++;
        continue;
      }

      // Faqat o‘zimiz yaratadigan URL formatini
      // qabul qilamiz. Boshqa manzilga murojaat yo‘q.
      const pattern = new RegExp(
        `^/api/persons/${person.id}/photo\\?v=` +
          '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' +
          '[0-9a-f]{4}-[0-9a-f]{12})$',
        'i',
      );

      const match = pattern.exec(person.photoUrl);

      if (!match) {
        summary.invalidPhotoUrl++;
        continue;
      }

      const filePath = join(photoDirectory, `${match[1]}.jpg`);

      let fileSize: number;

      try {
        const file = await stat(filePath);

        if (!file.isFile()) {
          summary.fileNotFound++;
          continue;
        }

        fileSize = file.size;
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          summary.fileNotFound++;
        } else {
          summary.invalidImage++;
        }

        continue;
      }

      if (fileSize === 0) {
        summary.invalidImage++;
        summary.emptyFile++;
        continue;
      }

      if (fileSize >= 200 * 1024) {
        summary.invalidImage++;
        summary.oversizedFile++;
        continue;
      }

      try {
        const image = sharp(filePath, {
          limitInputPixels: 25_000_000,
          failOn: 'warning',
        });

        const metadata = await image.metadata();

        const dimensionKey = `${metadata.width ?? 0}x${metadata.height ?? 0}`;

        summary.dimensions[dimensionKey] =
          (summary.dimensions[dimensionKey] ?? 0) + 1;

        if (metadata.format !== 'jpeg') {
          summary.invalidImage++;
          summary.wrongFormat++;
          continue;
        }

        const dimensionsValid =
          (metadata.width === 640 && metadata.height === 480) ||
          (metadata.width === 480 && metadata.height === 640);

        if (!dimensionsValid) {
          summary.invalidImage++;
          summary.wrongDimensions++;

          try {
            const prepared = await this.prepareTerminalFacePhoto(filePath);

            const preparedMetadata = await sharp(prepared).metadata();

            const validSize =
              prepared.length > 0 && prepared.length < 200 * 1024;

            const validDimensions =
              (preparedMetadata.width === 480 &&
                preparedMetadata.height === 640) ||
              (preparedMetadata.width === 640 &&
                preparedMetadata.height === 480);

            if (
              validSize &&
              validDimensions &&
              preparedMetadata.format === 'jpeg'
            ) {
              summary.convertible++;
            } else {
              summary.conversionFailed++;
            }
          } catch {
            summary.conversionFailed++;
          }

          continue;
        }

        if ((metadata.pages ?? 1) !== 1) {
          summary.invalidImage++;
          summary.wrongFormat++;
          continue;
        }

        // Rasmning haqiqatan ochilishini ham tekshiramiz.
        await sharp(filePath, {
          limitInputPixels: 25_000_000,
          failOn: 'warning',
        })
          .raw()
          .toBuffer();

        summary.ready++;
      } catch {
        summary.invalidImage++;
        summary.decodeError++;
      }
    }

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      checkedAt: new Date().toISOString(),
      ...summary,
      note: 'Tekshiruv faqat fayl mavjudligi, hajmi va JPEG metama’lumotlariga asoslangan.',
    };
  }

  async getTerminalFaceLibraries(terminalId: number, user: AuthenticatedUser) {
    // Mavjud hududiy ruxsat tekshiruvini ishlatamiz.
    await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const result = await this.hikvision.getFaceRecordsCount(terminal, password);

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      faceRecords: result.faceRecords,
      libraries: result.libraries,
      checkedAt: new Date().toISOString(),
    };
  }

  async getTerminalFaceMode(terminalId: number, user: AuthenticatedUser) {
    // Mavjud hududiy vakolat tekshiruvi.
    await this.getPersonSyncPreview(terminalId, user);

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const result = await this.hikvision.getFaceRecognizeMode(
      terminal,
      password,
    );

    return {
      ...result,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      checkedAt: new Date().toISOString(),
    };
  }
}
