import 'reflect-metadata';
import 'dotenv/config';

import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Region } from 'src/modules/regions/region.entity';
import { District } from 'src/modules/districts/district.entity';
import { School } from 'src/modules/schools/school.entity';
import { Person } from 'src/modules/persons/person.entity';
import { SchoolMembership } from '../modules/school-memberships/school-membership.entity';
import { User } from 'src/modules/users/user.entity';
import { AuthSession } from 'src/modules/auth/auth-session.entity';
import { Terminal } from '../modules/terminals/terminal.entity';
import { AttendanceEvent } from '../modules/attendance-events/attendance-event.entity';
import { DailyAttendance } from '../modules/daily-attendance/daily-attendance.entity';
import { Mahalla } from 'src/modules/mahallas/mahalla.entity';
import { SchoolClass } from '../modules/classes/school-class.entity';
import { AttendanceExcuse } from '../modules/attendance-excuses/attendance-excuse.entity';
import { AttendanceWeeklySchedule } from '../modules/attendance-calendar/attendance-weekly-schedule.entity';
import { AttendanceCalendarRule } from '../modules/attendance-calendar/attendance-calendar-rule.entity';
import { Subject } from '../modules/subjects/subject.entity';
import { TeacherClassSubject } from '../modules/teacher-assignments/teacher-class-subject.entity';
import { Textbook } from '../modules/textbooks/textbook.entity';
import { TextbookTopic } from '../modules/textbooks/textbook-topic.entity';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`.env faylida ${name} kiritilmagan`);
  }

  return value;
}

const port = Number(requiredEnv('DB_PORT'));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT noto‘g‘ri kiritilgan');
}

export default new DataSource({
  type: 'mysql',

  host: requiredEnv('DB_HOST'),
  port,
  username: requiredEnv('DB_USERNAME'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_DATABASE'),

  entities: [
    Region,
    District,
    School,
    Person,
    SchoolMembership,
    User,
    AuthSession,
    Terminal,
    AttendanceEvent,
    DailyAttendance,
    Mahalla,
    SchoolClass,
    AttendanceExcuse,
    AttendanceWeeklySchedule,
    AttendanceCalendarRule,
    Subject,
    TeacherClassSubject,
    Textbook,
    TextbookTopic,
  ],

  migrations: [join(__dirname, 'migrations', '*.js').replace(/\\/g, '/')],
  migrationsTableName: 'schema_migrations',

  synchronize: false,
  migrationsRun: false,

  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  connectTimeout: 10000,
});
