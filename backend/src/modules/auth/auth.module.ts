import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MeController } from './me.controller';
import { SchoolMembership } from '../school-memberships/school-membership.entity';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import { AuthSession } from './auth-session.entity';
import { AuthOriginGuard } from './guards/auth-origin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SchoolMembership, AuthSession]),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.getOrThrow<string>('JWT_SECRET');

        if (!/^[a-f0-9]{64}$/i.test(secret)) {
          throw new Error(
            'JWT_SECRET yaratilgan 64 belgili hex qiymat bo‘lishi kerak',
          );
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: 900,
            issuer: 'davomat-api',
            audience: 'davomat-cabinet',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'davomat-api',
            audience: 'davomat-cabinet',
          },
        };
      },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    ThrottlerGuard,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    AuthOriginGuard,
  ],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
