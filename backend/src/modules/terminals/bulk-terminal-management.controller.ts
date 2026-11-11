import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from './terminal.entity';
import { TerminalCryptoService } from './terminal-crypto.service';
import { HikvisionService } from './hikvision.service';

@Controller('terminals/bulk')
@Roles(UserRole.SUPER_ADMIN)
export class BulkTerminalManagementController {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    private readonly crypto: TerminalCryptoService,
    private readonly hikvision: HikvisionService,
  ) {}

  @Post('clear-preview')
  @HttpCode(200)
  async preview(@Body() body: unknown) {
    const input =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const ids = input.terminalIds;

    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 5 ||
      !ids.every(
        (id): id is number =>
          typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
      ) ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestException(
        '1–5 ta takrorlanmagan terminal ID kiriting',
      );
    }

    const terminals = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id IN (:...ids)', { ids })
      .getMany();

    if (terminals.length !== ids.length) {
      throw new BadRequestException('Tanlangan terminallardan biri topilmadi');
    }

    const results: Array<{
      terminalId: number;
      status: 'READY' | 'INACTIVE' | 'CHECK_FAILED';
      personsCount: number | null;
    }> = [];

    // Qurilmalarni bir vaqtda zo‘riqtirmaymiz.
    for (const id of ids) {
      const terminal = terminals.find((item) => item.id === id)!;

      if (!terminal.isActive || terminal.archivedAt) {
        results.push({
          terminalId: id,
          status: 'INACTIVE',
          personsCount: null,
        });
        continue;
      }

      try {
        const password = this.crypto.decrypt(terminal.passwordEncrypted);

        const count = await this.hikvision.getRegisteredPersonsCount(
          terminal,
          password,
        );

        results.push({
          terminalId: id,
          status: 'READY',
          personsCount: count,
        });
      } catch {
        results.push({
          terminalId: id,
          status: 'CHECK_FAILED',
          personsCount: null,
        });
      }
    }

    return {
      success: true,
      dryRun: true,
      willDelete: false,
      results,
      checkedAt: new Date().toISOString(),
    };
  }
}
