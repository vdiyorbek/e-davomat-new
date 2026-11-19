import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { PublishAssessmentDto } from './dto/publish-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { TeacherAssessmentsService } from './teacher-assessments.service';

function userOf(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

/** O‘qituvchi kabineti: AI yordamida CHSB/BSB testlari. */
@Controller('teacher/me')
@Roles(UserRole.TEACHER)
export class TeacherAssessmentsController {
  constructor(private readonly service: TeacherAssessmentsService) {}

  @Get('assignments/:assignmentId/assessment-topics')
  topics(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.availableTopics(userOf(request), assignmentId);
  }

  @Get('assessments')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query('assignmentId') assignmentId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const id =
      assignmentId && /^[1-9]\d*$/.test(assignmentId)
        ? Number(assignmentId)
        : undefined;
    return this.service.list(userOf(request), id);
  }

  @Post('assessments')
  create(
    @Body() dto: CreateAssessmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(userOf(request), dto);
  }

  @Get('assessments/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.detail(userOf(request), id);
  }

  @Patch('assessments/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssessmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(userOf(request), id, dto);
  }

  @Delete('assessments/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.remove(userOf(request), id);
  }

  @Patch('assessments/:id/questions/:questionId')
  updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: UpdateQuestionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateQuestion(userOf(request), id, questionId, dto);
  }

  @Delete('assessments/:id/questions/:questionId')
  deleteQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.deleteQuestion(userOf(request), id, questionId);
  }

  @Post('assessments/:id/regenerate')
  @HttpCode(200)
  regenerate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.regenerate(userOf(request), id);
  }

  @Post('assessments/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishAssessmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.publish(userOf(request), id, dto);
  }

  @Post('assessments/:id/close')
  @HttpCode(200)
  close(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.close(userOf(request), id);
  }

  @Get('assessments/:id/results')
  @Header('Cache-Control', 'private, no-store')
  results(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.results(userOf(request), id);
  }
}
