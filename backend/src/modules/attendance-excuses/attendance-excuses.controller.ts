import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  Get,
  Patch,
  Param,
  Query,
  Header,
  StreamableFile,
  ParseIntPipe,
} from '@nestjs/common';

import { GetAttendanceExcusesQueryDto } from './dto/get-attendance-excuses-query.dto';
import { CancelAttendanceExcuseDto } from './dto/cancel-attendance-excuse.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { AttendanceExcusesService } from './attendance-excuses.service';
import { CreateAttendanceExcuseDto } from './dto/create-attendance-excuse.dto';

@Controller('attendance-excuses')
@Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
export class AttendanceExcusesController {
  constructor(private readonly excusesService: AttendanceExcusesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 6,
        parts: 7,
      },
    }),
  )
  create(
    @Body() dto: CreateAttendanceExcuseDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.excusesService.create(dto, file, user);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  findAll(
    @Query() query: GetAttendanceExcusesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.excusesService.findAll(query, actor);
  }

  @Get(':id/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    const buffer = await this.excusesService.readPdf(id, actor);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'inline; filename="ariza.pdf"',
      length: buffer.length,
    });
  }

  @Patch(':id/cancel')
  @Header('Cache-Control', 'no-store')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAttendanceExcuseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.excusesService.cancel(id, dto, actor);
  }
}
