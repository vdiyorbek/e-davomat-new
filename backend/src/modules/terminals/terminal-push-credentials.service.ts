
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { Terminal } from './terminal.entity';
import { TerminalEventSource } from './enums/terminal-event-source.enum';
import { RedisService } from '../../redis/redis.service';
import { PUSH_TERMINALS_CHANGED_CHANNEL } from '../hikvision-push/hikvision-push.types';

@Injectable()
export class TerminalPushCredentialsService {
    constructor(
        @InjectRepository(Terminal)
        private readonly terminals: Repository<Terminal>,
        private readonly redisService: RedisService,
        private readonly config: ConfigService,
    ) { }

    /** Ingest serverlari token keshini darhol yangilaydi (aks holda ≤30 s). */
    async notifyIngest(): Promise<void> {
        await this.redisService
            .getClient()
            .publish(PUSH_TERMINALS_CHANGED_CHANNEL, String(Date.now()))
            .catch(() => undefined);
    }

    async generateToken(id: number) {
        const terminal = await this.terminals.findOneBy({ id });

        if (!terminal) {
            throw new NotFoundException('Terminal topilmadi');
        }

        if (!terminal.isActive || terminal.archivedAt) {
            throw new BadRequestException(
                'Nofaol yoki arxivlangan terminal uchun Push yoqib bo‘lmaydi',
            );
        }

        if (terminal.eventSource !== TerminalEventSource.PUSH) {
            throw new BadRequestException(
                'Terminal polling rejimida. Avval uni HTTP Push rejimiga o‘tkazing',
            );
        }

        const token = randomBytes(32).toString('hex');

        const hash = createHash('sha256')
            .update(token, 'utf8')
            .digest('hex');

        await this.terminals.update(
            { id },
            {
                pushTokenHash: hash,
                pushEnabled: true,
            },
        );

        await this.notifyIngest();

        const path = `/api/hikvision-push/${token}`;
        // Masalan: http://203.0.113.10:3001 — terminallar ulanadigan manzil.
        const raw = (this.config.get<string>('PUSH_PUBLIC_URL') ?? '').trim().replace(/\/+$/, '');
        // «10.10.11.14:3001» kabi sxemasiz yozilsa — http:// qo‘shamiz.
        const base = raw && !/^https?:\/\//i.test(raw) ? `http://${raw}` : raw;

        // Token faqat yaratilgan paytda qaytariladi.
        // Bazada faqat SHA-256 xeshi saqlanadi.
        return {
            terminalId: id,
            pushEnabled: true,
            token,
            path,
            url: base ? `${base}${path}` : null,
            message:
                'Tokenni xavfsiz saqlang. Qayta ko‘rish mumkin emas.',
        };
    }

    async disable(id: number) {
        const result = await this.terminals.update(
            { id },
            {
                pushEnabled: false,
                pushTokenHash: null,
            },
        );

        if (!result.affected) {
            throw new NotFoundException('Terminal topilmadi');
        }

        await this.notifyIngest();

        return {
            terminalId: id,
            pushEnabled: false,
            message: 'HTTP Push o‘chirildi va token bekor qilindi',
        };
    }

    async status(id: number) {
        const terminal = await this.terminals.findOneBy({ id });

        if (!terminal) {
            throw new NotFoundException('Terminal topilmadi');
        }

        return {
            terminalId: terminal.id,
            name: terminal.name,
            pushEnabled: terminal.pushEnabled,
            pushLastReceivedAt: terminal.pushLastReceivedAt,
            pushLastEventAt: terminal.pushLastEventAt,
        };
    }
}
