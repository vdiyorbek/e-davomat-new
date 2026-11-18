
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { Terminal } from './terminal.entity';

@Injectable()
export class TerminalPushCredentialsService {
    constructor(
        @InjectRepository(Terminal)
        private readonly terminals: Repository<Terminal>,
    ) { }

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

        // Token faqat yaratilgan paytda qaytariladi.
        // Bazada faqat SHA-256 xeshi saqlanadi.
        return {
            terminalId: id,
            pushEnabled: true,
            token,
            path: `/api/hikvision-push/${token}`,
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
