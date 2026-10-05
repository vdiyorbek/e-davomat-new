import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { RegionsModule } from './modules/regions/regions.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { PersonsModule } from './modules/persons/persons.module';
import { SchoolMembershipsModule } from './modules/school-memberships/school-memberships.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { AttendanceEventsModule } from './modules/attendance-events/attendance-events.module';
import { DailyAttendanceModule } from './modules/daily-attendance/daily-attendance.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminalSyncModule } from './modules/terminal-sync/terminal-sync.module';
import { AttendancePhotoSyncModule } from './modules/attendance-photo-sync/attendance-photo-sync.module';
import { MahallasModule } from './modules/mahallas/mahallas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    RedisModule,
    RegionsModule,
    DistrictsModule,
    SchoolsModule,
    PersonsModule,
    SchoolMembershipsModule,
    UsersModule,
    AuthModule,
    TerminalsModule,
    AttendanceEventsModule,
    DailyAttendanceModule,
    ScheduleModule.forRoot(),
    TerminalSyncModule,
    AttendancePhotoSyncModule,
    MahallasModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const port = Number(config.getOrThrow<string>('DB_PORT'));
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('DB_PORT noto‘g‘ri kiritilgan');
        }

        return {
          type: 'mysql',

          host: config.getOrThrow<string>('DB_HOST'),
          port,
          username: config.getOrThrow<string>('DB_USERNAME'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_DATABASE'),

          autoLoadEntities: true,
          synchronize: false,

          charset: 'utf8mb4_unicode_ci',
          timezone: 'Z',

          retryAttempts: 3,
          retryDelay: 2000,
          connectTimeout: 10000,

          logging: false,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
