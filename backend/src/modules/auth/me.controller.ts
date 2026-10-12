import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('me')
@Roles(...Object.values(UserRole))
export class MeController {
  @Get()
  @Header('Cache-Control', 'no-store')
  getProfile(@Req() request: AuthenticatedRequest) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      schoolId: user.schoolId,
    };
  }
}
