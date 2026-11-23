import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person.entity';
import { PersonGuardian } from './person-guardian.entity';
import { PersonGuardiansService } from './person-guardians.service';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PersonPhotosService } from './person-photos.service';
import { Mahalla } from '../mahallas/mahalla.entity';
import { FacePhotoQualityService } from './face-photo-quality.service';
@Module({
  imports: [TypeOrmModule.forFeature([Person, PersonGuardian, Mahalla])],
  controllers: [PersonsController],
  providers: [
    PersonsService,
    PersonPhotosService,
    PersonGuardiansService,
    FacePhotoQualityService,
  ],
  exports: [PersonsService],
})
export class PersonsModule {}
