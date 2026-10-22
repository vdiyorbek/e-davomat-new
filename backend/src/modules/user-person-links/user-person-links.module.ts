import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserPersonLink } from './user-person-link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserPersonLink])],
  exports: [TypeOrmModule],
})
export class UserPersonLinksModule {}
