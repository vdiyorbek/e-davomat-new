import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  Header,
  HttpCode,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from './person.entity';
import { PersonsService } from './persons.service';
import type { PersonsPage } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { GetPersonsQueryDto } from './dto/get-persons-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PersonPhotosService } from './person-photos.service';
import { UpdatePersonDto } from './dto/update-person.dto';

@Controller('persons')
@Roles(UserRole.SUPER_ADMIN)
export class PersonsController {
  constructor(
    private readonly personsService: PersonsService,
    private readonly personPhotosService: PersonPhotosService,
  ) {}

  @Post()
  create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.personsService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetPersonsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PersonsPage> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.personsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<Person> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.personsService.findOne(id, user);
  }

  @Post(':id/photo')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ id: number; photoUrl: string }> {
    return this.personPhotosService.upload(id, file);
  }

  @Get(':id/photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Roles(
    UserRole.USER,
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  async getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    const buffer = await this.personPhotosService.read(id, user);

    return new StreamableFile(buffer, {
      type: 'image/jpeg',
      disposition: 'inline',
      length: buffer.length,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonDto,
  ): Promise<Person> {
    return this.personsService.update(id, dto);
  }
}
