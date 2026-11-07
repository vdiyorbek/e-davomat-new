import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import { GetInspectorTalksQueryDto } from './dto/get-inspector-talks-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateInspectorTalkDto } from './dto/update-inspector-talk.dto';
import { CreateInspectorTalkDto } from './dto/create-inspector-talk.dto';
import { SetInspectorMahallasDto } from './dto/set-inspector-mahallas.dto';
import { InspectorsService } from './inspectors.service';

@Controller('inspectors')
export class InspectorsController {
  constructor(private readonly inspectorsService: InspectorsService) {}

  @Get('me/mahallas')
  @Roles(UserRole.MAHALLA_INSPECTOR)
  @Header('Cache-Control', 'private, no-store')
  listMyMahallas(@Req() request: AuthenticatedRequest) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.getMyMahallas(actor);
  }

  @Get(':userId/mahallas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  @Header('Cache-Control', 'private, no-store')
  getMahallas(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.getMahallas(userId, actor);
  }

  @Put(':userId/mahallas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.DISTRICT_ADMIN)
  @Header('Cache-Control', 'no-store')
  setMahallas(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetInspectorMahallasDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.setMahallas(userId, dto, actor);
  }

  @Post('me/talks')
  @Roles(UserRole.MAHALLA_INSPECTOR)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 7,
        parts: 8,
      },
    }),
  )
  createTalk(
    @Body() dto: CreateInspectorTalkDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.createTalk(dto, file, actor);
  }

  @Patch('me/talks/:id')
  @Roles(UserRole.MAHALLA_INSPECTOR)
  @Header('Cache-Control', 'no-store')
  updateTalk(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectorTalkDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.updateTalk(id, dto, actor);
  }

  @Delete('me/talks/:id')
  @Roles(UserRole.MAHALLA_INSPECTOR)
  @Header('Cache-Control', 'no-store')
  deleteTalk(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.deleteTalk(id, actor);
  }

  @Get('talks')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.MAHALLA_INSPECTOR,
  )
  @Header('Cache-Control', 'private, no-store')
  listTalks(
    @Query() query: GetInspectorTalksQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    return this.inspectorsService.listTalks(query, actor);
  }

  @Get('talks/:id/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.MAHALLA_INSPECTOR,
  )
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getTalkPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const actor = request.authUser;
    if (!actor) throw new UnauthorizedException();

    const buffer = await this.inspectorsService.readTalkPdf(id, actor);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'inline; filename="suhbat.pdf"',
      length: buffer.length,
    });
  }
}
