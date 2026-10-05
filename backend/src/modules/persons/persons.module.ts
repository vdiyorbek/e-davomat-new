import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person.entity';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PersonPhotosService } from './person-photos.service';
import { Mahalla } from '../mahallas/mahalla.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Mahalla])],
  controllers: [PersonsController],
  providers: [PersonsService, PersonPhotosService],
  exports: [PersonsService],
})
export class PersonsModule {}
