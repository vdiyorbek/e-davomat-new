import {
  Controller,
  Get,
  Header,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SystemMonitorDetailsService } from './system-monitor-details.service';
import { SystemMonitorService } from './system-monitor.service';

@Controller()
export class SystemMonitorController {
  constructor(
    private readonly monitor: SystemMonitorService,
    private readonly detailsService: SystemMonitorDetailsService,
  ) {}

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

  /** «Batafsil» oynasi: tekshiruv ortidagi aniq ro‘yxat (faqat o‘qiydi). */
  @Get('system/health/:key/details')
  @Roles(UserRole.SUPER_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  detail(@Param('key') key: string) {
    return this.detailsService.details(key);
  }
}
