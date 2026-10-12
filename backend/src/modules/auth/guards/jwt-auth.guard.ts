import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { AuthSession } from '../auth-session.entity';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
      throw new UnauthorizedException('Kirish tokeni yuborilmagan');
    }

    let userId: number;
    let sessionId: string;

    try {
      const payload: unknown = await this.jwtService.verifyAsync(match[1]);

      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('sub' in payload) ||
        typeof payload.sub !== 'string' ||
        !/^[1-9][0-9]*$/.test(payload.sub) ||
        !('sid' in payload) ||
        typeof payload.sid !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.sid,
        ) ||
        !('exp' in payload) ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Token tarkibi noto‘g‘ri');
      }

      userId = Number(payload.sub);
      sessionId = payload.sid;

      if (!Number.isSafeInteger(userId) || userId > 4294967295) {
        throw new Error('Hisob identifikatori noto‘g‘ri');
      }
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati tugagan');
    }

    const session = await this.sessionsRepository.findOneBy({
      id: sessionId,
      userId,
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Sessiya faol emas');
    }

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :active', { active: true })
      .andWhere('person.deletedAt IS NULL')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Hisob faol emas');
    }

    request.authUser = {
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

    return true;
  }
}
