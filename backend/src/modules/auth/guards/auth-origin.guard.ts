import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const allowedOrigin = new URL(
      this.config.getOrThrow<string>('FRONTEND_URL'),
    ).origin;

    if (request.headers.origin !== allowedOrigin) {
      throw new ForbiddenException("So'rov manbasiga ruxsat berilmagan");
    }

    return true;
  }
}
