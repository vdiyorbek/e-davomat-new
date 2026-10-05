import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { District } from './district.entity';
import { Region } from '../regions/region.entity';
import { CreateDistrictDto } from './dto/create-district.dto';

@Injectable()
export class DistrictsService {
  constructor(
    @InjectRepository(District)
    private readonly districtsRepository: Repository<District>,

    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
  ) {}

  async findAll(regionId?: number): Promise<District[]> {
    return this.districtsRepository.find({
      where: regionId === undefined ? {} : { regionId },
      relations: {
        region: true,
      },
      order: {
        name: 'ASC',
        id: 'ASC',
      },
    });
  }

  async create(dto: CreateDistrictDto): Promise<District> {
    const region = await this.regionsRepository.findOneBy({
      id: dto.regionId,
    });
    if (!region) {
      throw new NotFoundException('Tanlangan hudud topilmadi');
    }
    const district = this.districtsRepository.create({
      name: dto.name,
      regionId: dto.regionId,
    });

    try {
      return await this.districtsRepository.save(district);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };
        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException(
            'Ushbu hududda bu nomdagi tuman yoki shahar mavjud',
          );
        }
        if (driverError.code === 'ER_NO_REFERENCED_ROW_2') {
          throw new NotFoundException('Tanlangan hudud topilmadi');
        }
      }
      throw error;
    }
  }
}
