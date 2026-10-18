import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { TextbooksService } from './textbooks.service';
import { UploadTextbookDto } from './dto/upload-textbook.dto';

@Controller('textbooks')
@Roles(UserRole.SUPER_ADMIN)
export class TextbooksController {
  constructor(private readonly textbooksService: TextbooksService) {}

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
}
