
import {
    Controller,
    Get,
    Header,
    HttpCode,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { TerminalPushCredentialsService } from './terminal-push-credentials.service';

@Controller('terminals')
@Roles(UserRole.SUPER_ADMIN)
export class TerminalPushController {
    constructor(
        private readonly credentials: TerminalPushCredentialsService,
    ) { }

    @Post(':id/push/token')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    generateToken(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.credentials.generateToken(id);
    }

    @Post(':id/push/disable')
    @HttpCode(200)
    disable(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.credentials.disable(id);
    }

    @Get(':id/push/status')
    status(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.credentials.status(id);
    }
}
