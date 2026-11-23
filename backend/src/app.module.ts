import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmOptions } from './database/typeorm-options';
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
import { ClassesModule } from './modules/classes/classes.module';
import { AttendanceExcusesModule } from './modules/attendance-excuses/attendance-excuses.module';
import { AttendanceCalendarModule } from './modules/attendance-calendar/attendance-calendar.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeacherAssignmentsModule } from './modules/teacher-assignments/teacher-assignments.module';
import { TextbooksModule } from './modules/textbooks/textbooks.module';
import { LessonSchedulesModule } from './modules/lesson-schedules/lesson-schedules.module';
import { LessonSessionsModule } from './modules/lesson-sessions/lesson-sessions.module';
import { UserPersonLinksModule } from './modules/user-person-links/user-person-links.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { MembershipDetailsModule } from './modules/membership-details/membership-details.module';
import { MemberAccountsModule } from './modules/member-accounts/member-accounts.module';
import { InspectorsModule } from './modules/inspectors/inspectors.module';
import { HomeroomModule } from './modules/homeroom/homeroom.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SystemMonitorModule } from './modules/system-monitor/system-monitor.module';
import { LiveModule } from './modules/live/live.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventBackfillModule } from './modules/event-backfill/event-backfill.module';
import { SystemSettingsModule } from './modules/system-settings/settings.module';
import { EventActivityModule } from './modules/event-activity/event-activity.module';
import { StudentModule } from './modules/student/student.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';

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
    ClassesModule,
    AttendanceExcusesModule,
    InspectorsModule,
    NotificationsModule,
    AnnouncementsModule,
    SystemMonitorModule,
    HomeroomModule,
    AttendanceCalendarModule,
    SubjectsModule,
    TeacherAssignmentsModule,
    TextbooksModule,
    LessonSchedulesModule,
    LessonSessionsModule,
    UserPersonLinksModule,
    TeacherModule,
    MembershipDetailsModule,
    MemberAccountsModule,
    LiveModule,
    DashboardModule,
    EventBackfillModule,
    SystemSettingsModule,
    EventActivityModule,
    StudentModule,
    AssessmentsModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmOptions(config),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
