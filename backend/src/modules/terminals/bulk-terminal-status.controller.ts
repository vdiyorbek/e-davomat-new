import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Terminal } from './terminal.entity';

@Controller('terminals/bulk')
@Roles(UserRole.SUPER_ADMIN)
export class BulkTerminalStatusController {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,
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
}
