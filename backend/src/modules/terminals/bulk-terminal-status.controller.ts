import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, DataSource } from 'typeorm';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from './terminal.entity';

@Controller('terminals/bulk')
@Roles(UserRole.SUPER_ADMIN)
export class BulkTerminalStatusController {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
    private readonly dataSource: DataSource,
  ) {}

  @Post('activate')
  @HttpCode(200)
  async activate(@Body() body: unknown) {
    const input =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const ids = input.terminalIds;

    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 100 ||
      !ids.every(
        (id): id is number =>
          typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
      ) ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestException(
        '1–100 ta takrorlanmagan terminal ID kiriting',
      );
    }

    if (input.confirm !== 'ACTIVATE_SELECTED_TERMINALS') {
      throw new BadRequestException('Faollashtirish tasdiqlanmagan');
    }

    const terminals = await this.terminalsRepository.findBy({
      id: In(ids),
    });

    if (terminals.length !== ids.length) {
      throw new BadRequestException('Tanlangan terminallardan biri topilmadi');
    }

    if (terminals.some((terminal) => terminal.archivedAt !== null)) {
      throw new BadRequestException(
        'Arxivlangan terminalni avval arxivdan tiklang',
      );
    }

    const update = await this.terminalsRepository.update(
      {
        id: In(ids),
        archivedAt: IsNull(),
        isActive: false,
      },
      {
        isActive: true,
      },
    );

    return {
      success: true,
      selected: ids.length,
      activated: update.affected ?? 0,
      alreadyActive: ids.length - (update.affected ?? 0),
      message: 'Terminallarning tizim holati faollashtirildi',
    };
  }

  @Post('sync-start')
  @HttpCode(200)
  async bulkSyncStart(@Body() body: unknown) {
    const input =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const ids = input.terminalIds;
    const startTime = input.startTime;

    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 100 ||
      !ids.every(
        (id): id is number =>
          typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
      ) ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestException('1–100 ta takrorlanmagan terminal tanlang');
    }

    if (
      typeof startTime !== 'string' ||
      !/^20\d{2}-\d{2}-\d{2}T00:00:00\+05:00$/.test(startTime)
    ) {
      throw new BadRequestException(
        'Vaqt YYYY-MM-DDT00:00:00+05:00 formatida bo‘lishi kerak',
      );
    }

    const startAt = new Date(startTime);

    if (
      !Number.isFinite(startAt.getTime()) ||
      startAt.getTime() > Date.now() ||
      new Date(startAt.getTime() + 5 * 3600_000).toISOString().slice(0, 10) !==
        startTime.slice(0, 10)
    ) {
      throw new BadRequestException('Noto‘g‘ri yoki kelajakdagi sana');
    }

    if (input.confirm !== 'SET_BULK_SYNC_START') {
      throw new BadRequestException('Sinxronlash vaqti tasdiqlanmagan');
    }

    // Barcha tanlangan terminallarni bir tranzaksiyada
    // tekshiramiz va yangilaymiz.
    return this.dataSource.transaction(async (manager) => {
      const terminals = await manager
        .createQueryBuilder(Terminal, 'terminal')
        .where('terminal.id IN (:...ids)', { ids })
        .orderBy('terminal.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      if (terminals.length !== ids.length) {
        throw new BadRequestException('Terminallardan biri topilmadi');
      }

      const invalid = terminals.filter(
        (terminal) =>
          !terminal.isActive ||
          terminal.archivedAt !== null ||
          terminal.syncStartAt !== null ||
          terminal.eventsSyncedUntil !== null,
      );

      if (invalid.length > 0) {
        throw new BadRequestException({
          message: 'Ba’zi terminallarga boshlanish vaqtini belgilab bo‘lmaydi',
          terminalIds: invalid.map((terminal) => terminal.id),
        });
      }

      const result = await manager
        .createQueryBuilder()
        .update(Terminal)
        .set({ syncStartAt: startAt })
        .where('id IN (:...ids)', { ids })
        .andWhere('isActive = :active', { active: true })
        .andWhere('archivedAt IS NULL')
        .andWhere('syncStartAt IS NULL')
        .andWhere('eventsSyncedUntil IS NULL')
        .execute();

      if (result.affected !== ids.length) {
        throw new BadRequestException(
          'Terminal holati o‘zgargan, operatsiya bekor qilindi',
        );
      }

      return {
        success: true,
        updated: result.affected,
        terminalIds: ids,
        syncStartAt: startAt.toISOString(),
        message: 'Sinxronlash boshlanish vaqti saqlandi',
      };
    });
  }
}
