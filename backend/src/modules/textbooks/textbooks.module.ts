import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Subject } from '../subjects/subject.entity';
import { Textbook } from './textbook.entity';

import { TextbooksController } from './textbooks.controller';
import { TextbooksService } from './textbooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Textbook, Subject])],
  controllers: [TextbooksController],
  providers: [TextbooksService],
  exports: [TextbooksService],
})
export class TextbooksModule {}
