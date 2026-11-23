import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { AttendanceExcuseStatus } from '../attendance-excuses/attendance-excuse.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { SubmitHomeroomExcuseDto } from './dto/submit-homeroom-excuse.dto';
import { HomeroomService } from './homeroom.service';

function authUser(request: AuthenticatedRequest): AuthenticatedUser {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

/** Sinf rahbari kabineti: faqat o‘ziga biriktirilgan sinflar. */
@Controller('homeroom')
@Roles(UserRole.TEACHER)
export class HomeroomController {
  constructor(private readonly homeroom: HomeroomService) {}

  @Get('classes')
  @Header('Cache-Control', 'private, no-store')
  classes(@Req() request: AuthenticatedRequest) {
    return this.homeroom.classes(authUser(request));
  }

  @Get('classes/:classId/attendance')
  @Header('Cache-Control', 'private, no-store')
  attendance(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('date') date: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.homeroom.attendance(authUser(request), classId, date);
  }

  @Get('classes/:classId/week')
  @Header('Cache-Control', 'private, no-store')
  week(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.homeroom.week(authUser(request), classId, from, to);
  }

  @Get('classes/:classId/absentees')
  @Header('Cache-Control', 'private, no-store')
  absentees(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('minDays') minDays: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const days = Math.min(Math.max(Number(minDays) || 2, 1), 30);
    return this.homeroom.absentees(authUser(request), classId, days);
  }

  @Get('classes/:classId/absentees/export')
  async exportAbsentees(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('minDays') minDays: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const days = Math.min(Math.max(Number(minDays) || 2, 1), 30);
    await this.homeroom.exportAbsentees(
      authUser(request),
      classId,
      days,
      response,
    );
  }

  @Get('classes/:classId/students/:personId')
  @Header('Cache-Control', 'private, no-store')
  student(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('personId', ParseIntPipe) personId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.homeroom.student(authUser(request), classId, personId);
  }

  @Get('classes/:classId/excuses')
  @Header('Cache-Control', 'private, no-store')
  excuses(
    @Param('classId', ParseIntPipe) classId: number,
    @Query('status') status: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const value = Object.values(AttendanceExcuseStatus).includes(
      status as AttendanceExcuseStatus,
    )
      ? (status as AttendanceExcuseStatus)
      : undefined;
    return this.homeroom.listExcuses(authUser(request), classId, value);
  }

  @Post('classes/:classId/excuses')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 6, parts: 7 },
    }),
  )
  submitExcuse(
    @Param('classId', ParseIntPipe) classId: number,
    @Body() dto: SubmitHomeroomExcuseDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.homeroom.submitExcuse(authUser(request), classId, dto, file);
  }

  @Get('excuses/:id/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async pdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const buffer = await this.homeroom.excusePdf(authUser(request), id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'inline; filename="ariza.pdf"',
      length: buffer.length,
    });
  }
}
