import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';

import { District } from './district.entity';
import { DistrictsService } from './districts.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { GetDistrictsQueryDto } from './dto/get-districts-quey.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('districts')
@Roles(UserRole.SUPER_ADMIN)
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  findAll(@Query() query: GetDistrictsQueryDto): Promise<District[]> {
    return this.districtsService.findAll(query.regionId);
  }

  @Post()
  create(@Body() dto: CreateDistrictDto): Promise<District> {
    return this.districtsService.create(dto);
  }

  @Get('options')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  async findOptions(@Query() query: GetDistrictsQueryDto) {
    if (query.regionId === undefined) {
      throw new BadRequestException('Viloyatni tanlang');
    }

    const districts = await this.districtsService.findAll(query.regionId);

    return districts.map((district) => ({
      id: district.id,
      name: district.name,
      regionId: district.regionId,
    }));
  }
}
