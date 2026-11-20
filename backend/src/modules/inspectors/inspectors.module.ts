import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { District } from '../districts/district.entity';
import { Mahalla } from '../mahallas/mahalla.entity';
import { User } from '../users/user.entity';

import { InspectorMahalla } from './inspector-mahalla.entity';
import { InspectorCase } from './inspector-case.entity';
import { InspectorCasesController } from './inspector-cases.controller';
import { InspectorCasesService } from './inspector-cases.service';
import { InspectorTalk } from './inspector-talk.entity';
import { InspectorsController } from './inspectors.controller';
import { InspectorsService } from './inspectors.service';
import { AttendanceCalendarModule } from '../attendance-calendar/attendance-calendar.module';
import { AttendanceExcuse } from '../attendance-excuses/attendance-excuse.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      District,
      Mahalla,
      InspectorMahalla,
      InspectorTalk,
      InspectorCase,
      AttendanceExcuse,
    ]),
    AttendanceCalendarModule,
  ],
  controllers: [InspectorsController, InspectorCasesController],
  providers: [InspectorsService, InspectorCasesService],
  exports: [InspectorsService],
})
export class InspectorsModule {}
