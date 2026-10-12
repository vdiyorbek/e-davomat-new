import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { School } from '../schools/school.entity';
import { SchoolClass } from './school-class.entity';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolClass, School])],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
