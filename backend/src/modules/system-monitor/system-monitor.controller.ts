import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SystemMonitorService } from './system-monitor.service';

@Controller()
export class SystemMonitorController {
  constructor(private readonly monitor: SystemMonitorService) {}

  /** Tashqi kuzatuv xizmatlari uchun: faqat ishlayaptimi (ma’lumot oshkor qilinmaydi). */
  @Public()
  @Get('health')
  @Header('Cache-Control', 'no-store')
  async health() {
    if (!(await this.monitor.liveness())) {
      throw new ServiceUnavailableException({ status: 'down' });
    }
    return { status: 'ok' };
  }

  /** To‘liq tizim holati — faqat Bosh administrator. */
  @Get('system/health')
  @Roles(UserRole.SUPER_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  details() {
    return this.monitor.current();
  }
}
