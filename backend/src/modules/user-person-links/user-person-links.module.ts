import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserPersonLink } from './user-person-link.entity';
import { UserPersonLinksService } from './user-person-links.service';
import { UserPersonLinksController } from './user-person-links.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPersonLink])],
  controllers: [UserPersonLinksController],
  providers: [UserPersonLinksService],
  exports: [UserPersonLinksService],
})
export class UserPersonLinksModule {}
