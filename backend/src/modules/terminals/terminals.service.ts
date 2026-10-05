import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { School } from '../schools/school.entity';

import { Terminal } from './terminal.entity';
import { TerminalCryptoService } from './terminal-crypto.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { GetTerminalsQueryDto } from './dto/get-terminals-query.dto';
import { HikvisionService } from './hikvision.service';
import type { HikvisionDeviceInfo } from './hikvision.service';
import { StartTerminalSyncDto } from './dto/start-terminal-sync.dto';

@Injectable()
export class TerminalsService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(School)
    private readonly schoolsRepository: Repository<School>,

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

  async findAll(query: GetTerminalsQueryDto, user: AuthenticatedUser) {
    const builder = this.terminalsRepository
      .createQueryBuilder('terminal')
      .innerJoinAndSelect('terminal.school', 'school')
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

    if (query.direction !== undefined) {
      builder.andWhere('terminal.direction = :filterDirection', {
        filterDirection: query.direction,
      });
    }

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
}
