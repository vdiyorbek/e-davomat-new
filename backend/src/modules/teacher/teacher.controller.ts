import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  Param,
  ParseIntPipe,
  Query,
  Body,
  Patch,
  Post,
  Header,
  StreamableFile,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';
import { UpdateTeacherSessionDto } from './dto/update-teacher-session.dto';
import { TeacherService } from './teacher.service';
import { TeacherCabinetService } from './teacher-cabinet.service';

@Controller('teacher')
@Roles(UserRole.TEACHER)
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly cabinet: TeacherCabinetService,
  ) {}

  /** Barcha sinflardagi darslar: bugun (from=to) yoki hafta. */
  @Get('me/schedule')
  @Header('Cache-Control', 'private, no-store')
  mySchedule(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.cabinet.schedule(request.authUser, from, to);
  }

  @Get('me/textbooks/:textbookId/pdf')
  @Header('Cache-Control', 'private, no-store')
  async textbookPdf(
    @Param('textbookId', ParseIntPipe) textbookId: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    const pdf = await this.cabinet.textbookPdf(request.authUser, textbookId);

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'inline',
      length: pdf.length,
    });
  }

  @Get('me/assignments')
  myAssignments(@Req() request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.myAssignments(request.authUser);
  }

  @Get('me/journal/:assignmentId')
  myJournal(
    @Param('assignmentId', ParseIntPipe)
    assignmentId: number,

    @Query('date')
    date: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.myJournal(assignmentId, date, request.authUser);
  }

  @Post('me/journal/:assignmentId/sessions')
  createJournalSession(
    @Param('assignmentId', ParseIntPipe)
    assignmentId: number,
    @Body() dto: CreateTeacherSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.createJournalSession(
      assignmentId,
      dto,
      request.authUser,
    );
  }

  @Get('me/journal/:assignmentId/sessions/:sessionId/topics')
  journalTopics(
    @Param('assignmentId', ParseIntPipe)
    assignmentId: number,
    @Param('sessionId', ParseIntPipe)
    sessionId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.journalTopics(
      assignmentId,
      sessionId,
      request.authUser,
    );
  }

  @Patch('me/journal/:assignmentId/sessions/:sessionId')
  updateJournalSession(
    @Param('assignmentId', ParseIntPipe)
    assignmentId: number,
    @Param('sessionId', ParseIntPipe)
    sessionId: number,
    @Body() dto: UpdateTeacherSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    return this.teacherService.updateJournalSession(
      assignmentId,
      sessionId,
      dto,
      request.authUser,
    );
  }
}
