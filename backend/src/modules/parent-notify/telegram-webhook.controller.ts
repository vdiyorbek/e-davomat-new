import { timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { ParentBotService } from './parent-bot.service';
import type { TgUpdate } from './parent-bot.service';
import { telegramConfig } from './telegram-api.service';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly bot: ParentBotService) {}

  /** Telegram webhook: `X-Telegram-Bot-Api-Secret-Token` sirli kalit bilan himoyalangan. */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TgUpdate,
  ) {
    const expected = Buffer.from(telegramConfig().secret);
    const given = Buffer.from(secret ?? '');
    if (
      expected.length < 16 ||
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    ) {
      throw new UnauthorizedException();
    }
    // Telegramga tez javob beramiz; qayta ishlash fonda (xatolar ichkarida ushlanadi).
    void this.bot.handle(update);
    return { ok: true };
  }
}
