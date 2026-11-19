import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { StudentAssessmentsService } from './student-assessments.service';

function userOf(request: AuthenticatedRequest) {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser;
}

@Controller('student/me/assessments')
@Roles(UserRole.STUDENT)
export class StudentAssessmentsController {
  constructor(private readonly service: StudentAssessmentsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.service.list(userOf(request));
  }

  @Post(':id/start')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  start(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.start(userOf(request), id);
  }

  @Put(':id/answers')
  save(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveAnswersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.saveAnswers(userOf(request), id, dto.answers);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveAnswersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.submit(userOf(request), id, dto.answers);
  }

  @Get(':id/result')
  @Header('Cache-Control', 'private, no-store')
  result(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.result(userOf(request), id);
  }
}
