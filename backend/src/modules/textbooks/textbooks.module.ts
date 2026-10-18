import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Subject } from '../subjects/subject.entity';
import { Textbook } from './textbook.entity';
import { TextbookTopic } from './textbook-topic.entity';
import { TextbookTopicsService } from './textbook-topics.service';
import { TextbooksController } from './textbooks.controller';
import { TextbooksService } from './textbooks.service';
import { GeminiTextbookService } from './gemini-textbook.service';

@Module({
  imports: [TypeOrmModule.forFeature([Textbook, TextbookTopic, Subject])],
  controllers: [TextbooksController],
  providers: [TextbooksService, TextbookTopicsService, GeminiTextbookService],
  exports: [TextbooksService],
})
export class TextbooksModule {}
