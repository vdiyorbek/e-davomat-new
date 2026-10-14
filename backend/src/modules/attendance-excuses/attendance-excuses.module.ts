import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceExcuse } from './attendance-excuse.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceExcuse])],
  controllers: [],
  providers: [],
})
export class AttendanceExcusesModule {}
