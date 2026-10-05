import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { District } from '../districts/district.entity';
import { School } from '../schools/school.entity';

import { Mahalla } from './mahalla.entity';
import { MahallasController } from './mahallas.controller';
import { MahallasService } from './mahallas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Mahalla, District, School])],
  controllers: [MahallasController],
  providers: [MahallasService],
  exports: [MahallasService, TypeOrmModule],
})
export class MahallasModule {}
