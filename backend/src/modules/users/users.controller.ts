import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Get,
  Query,
  UnauthorizedException,
  Req,
  Delete,
  HttpCode,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserPhotosService } from './user-photos.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@Roles(UserRole.SUPER_ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userPhotosService: UserPhotosService,
  ) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  create(@Body() dto: CreateUserDto, @Req() request: AuthenticatedRequest) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.create(dto, currentUser);
  }

  @Patch(':id/access')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.updateAccess(id, dto, currentUser);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  findAll(
    @Query() query: GetUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.findAll(query, currentUser);
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
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUser = request.authUser;

    if (!currentUser) {
      throw new UnauthorizedException();
    }

    return this.usersService.remove(id, currentUser);
  }

  @Post(':id/photo')
  @Roles(...Object.values(UserRole))
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
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
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.userPhotosService.upload(id, actor, file);
  }

  @Get(':id/photo')
  @Roles(...Object.values(UserRole))
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    const buffer = await this.userPhotosService.read(id, actor);

    return new StreamableFile(buffer, {
      type: 'image/jpeg',
      disposition: 'inline',
      length: buffer.length,
    });
  }

  @Delete(':id/photo')
  @Roles(...Object.values(UserRole))
  @Header('Cache-Control', 'no-store')
  removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;

    if (!actor) {
      throw new UnauthorizedException();
    }

    return this.userPhotosService.remove(id, actor);
  }
}
