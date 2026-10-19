import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  Get,
  Patch,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateTextbookTopicDto } from './dto/update-textbook-topic.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { GeminiTextbookService } from './gemini-textbook.service';
import { TextbooksService } from './textbooks.service';
import { UploadTextbookDto } from './dto/upload-textbook.dto';
import { TextbookTopicsService } from './textbook-topics.service';
import { CreateTextbookTopicDto } from './dto/create-textbook-topic.dto';

@Controller('textbooks')
@Roles(UserRole.SUPER_ADMIN)
export class TextbooksController {
  constructor(
    private readonly textbooksService: TextbooksService,
    private readonly textbookTopicsService: TextbookTopicsService,
    private readonly geminiTextbookService: GeminiTextbookService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 30 * 1024 * 1024,
        files: 1,
        fields: 7,
        parts: 8,
        fieldSize: 2048,
      },
    }),
  )
  upload(
    @Body() dto: UploadTextbookDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.textbooksService.upload(dto, file, actor);
  }

  @Post(':id/extract-topics')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async extractTopics(
    @Param('id', ParseIntPipe) textbookId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    // Avval mavzular mavjudligini tekshiramiz.
    await this.textbookTopicsService.ensureCanExtract(textbookId, actor);

    // Gemini PDF'dan mavzularni ajratadi.
    const result = await this.geminiTextbookService.extractTopics(
      textbookId,
      actor,
    );

    // Mavzularni administrator tasdig'ini kutish
    // holatida bazaga saqlaymiz.
    const saved = await this.textbookTopicsService.saveExtracted(
      textbookId,
      result.topics,
      actor,
    );

    return {
      ...saved,
      model: result.model,
      topics: result.topics,
    };
  }

  @Get(':id/topics')
  @Header('Cache-Control', 'no-store')
  getTopics(
    @Param('id', ParseIntPipe) textbookId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.textbookTopicsService.findByTextbook(textbookId, actor);
  }

  @Patch('topics/:topicId')
  updateTopic(
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() dto: UpdateTextbookTopicDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.textbookTopicsService.updateTopic(topicId, dto, actor);
  }

  @Patch('topics/:topicId/approve')
  approveTopic(
    @Param('topicId', ParseIntPipe) topicId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.textbookTopicsService.approveTopic(topicId, actor);
  }

  @Get()
  findAll() {
    return this.textbooksService.findAll();
  }

  @Post(':id/topics')
  createManualTopic(
    @Param('id', ParseIntPipe) textbookId: number,
    @Body() dto: CreateTextbookTopicDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.textbookTopicsService.createManualTopic(textbookId, dto, actor);
  }
}
