import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';

import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { ImportSchoolStudentsDto } from './dto/import-school-students.dto';
import { SchoolStudentsService } from './school-students.service';
import { StudentImportService } from './student-import.service';
import type { StudentImportReport } from './student-import.service';
import type { CreatedSchoolStudent } from './school-students.service';

@Controller('school-students')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.REGION_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.SCHOOL_ADMIN,
)
export class SchoolStudentsController {
  constructor(
    private readonly studentsService: SchoolStudentsService,
    private readonly importService: StudentImportService,
  ) {}

  @Get('import/template')
  @Header('Cache-Control', 'no-store')
  async downloadTemplate(): Promise<StreamableFile> {
    const buffer = await this.importService.buildTemplate();

    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="oquvchilar-shabloni.xlsx"',
      length: buffer.length,
    });
  }

  @Post('import')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 3,
        parts: 4,
      },
    }),
  )
  importStudents(
    @Body() dto: ImportSchoolStudentsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentImportReport> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.importService.run(file, dto, user);
  }

  @Post()
  create(
    @Body() dto: CreateSchoolStudentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreatedSchoolStudent> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.studentsService.create(dto, user);
  }
}
