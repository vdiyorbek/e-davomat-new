import { Body, Controller, Get, Post } from '@nestjs/common';

import { RegionsService } from './regions.service';
import { Region } from './region.entity';
import { CreateRegionDto } from './dto/create-region.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('regions')
@Roles(UserRole.SUPER_ADMIN)
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  findAll(): Promise<Region[]> {
    return this.regionsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRegionDto): Promise<Region> {
    return this.regionsService.create(dto);
  }

  @Get('options')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.REGION_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SCHOOL_ADMIN,
  )
  async findOptions() {
    const regions = await this.regionsService.findAll();

    return regions.map((region) => ({
      id: region.id,
      name: region.name,
    }));
  }
}
