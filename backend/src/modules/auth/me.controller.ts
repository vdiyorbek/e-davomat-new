import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('me')
@Roles(...Object.values(UserRole))
@UseGuards(ThrottlerGuard)
export class MeController {
  constructor(private readonly authService: AuthService) {}

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
      photoUrl: user.photoUrl,
      mustChangePassword: user.mustChangePassword === true,
    };
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    await this.authService.changePassword(user.id, user.sessionId, dto);
  }
}
