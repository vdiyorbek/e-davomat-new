import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { EventCompactionService } from './event-compaction.service';

@Controller('event-compaction')
@Roles(UserRole.SUPER_ADMIN)
export class EventCompactionController {
  constructor(private readonly service: EventCompactionService) {}

  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status() {
    return this.service.status();
  }

  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  history() {
    return this.service.history(50);
  }

  /** Haftalik jadvaldan tashqari qo‘lda ishga tushirish (faqat sozlamadan yoqilgan bo‘lsa). */
  @Post('run')
  @HttpCode(202)
  async run(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) throw new UnauthorizedException();
    const status = await this.service.status();
    if (!status.enabled) {
      throw new BadRequestException(
        'Avval «Tizim sozlamalari»da tozalashni yoqing',
      );
    }
    if (status.running) {
      throw new BadRequestException('Tozalash allaqachon ketmoqda');
    }
    void this.service.run('MANUAL', request.authUser.id);
    return { started: true };
  }

  /** Quruq sinov: hech narsa o‘chirmaydi, namunada qancha o‘chirilishini sanaydi. */
  @Post('preview')
  @Header('Cache-Control', 'private, no-store')
  preview() {
    return this.service.preview();
  }
}
