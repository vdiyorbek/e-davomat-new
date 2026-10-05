import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { MeService } from './me.service';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('me')
@Roles(...Object.values(UserRole))
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getProfile(@Req() request: AuthenticatedRequest) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    const person = user.person;

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      personId: user.personId,
      person: {
        id: person.id,
        pnfl: person.pnfl,
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        gender: person.gender,
        nationality: person.nationality,
        birthDate: person.birthDate,
        address: person.address,
        phoneNumber: person.phoneNumber,
        photoUrl: person.photoUrl,
      },
    };
  }

  @Get('schools')
  @Header('Cache-Control', 'no-store')
  getSchools(@Req() request: AuthenticatedRequest) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.meService.findSchools(user.personId);
  }
}
