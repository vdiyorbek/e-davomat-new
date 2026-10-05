import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { Region } from './region.entity';
import { CreateRegionDto } from './dto/create-region.dto';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
  ) {}

  async findAll(): Promise<Region[]> {
    return this.regionsRepository.find({
      order: {
        name: 'ASC',
        id: 'ASC',
      },
    });
  }

  async create(dto: CreateRegionDto): Promise<Region> {
    const region = this.regionsRepository.create({
      name: dto.name,
    });
    try {
      return await this.regionsRepository.save(region);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };
        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException('Bu nomdagi hudud allaqachon mavjud');
        }
      }
      throw error;
    }
  }
}
