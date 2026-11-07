import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { SetInspectorMahallasDto } from './dto/set-inspector-mahallas.dto';
import { InspectorsService } from './inspectors.service';

@Controller('inspectors')
export class InspectorsController {
  constructor(private readonly inspectorsService: InspectorsService) {}

  @Get(':userId/mahallas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  getMahallas(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.getMahallas(userId, actor);
  }

  @Put(':userId/mahallas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  @Header('Cache-Control', 'no-store')
  setMahallas(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetInspectorMahallasDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.setMahallas(userId, dto, actor);
  }
}
