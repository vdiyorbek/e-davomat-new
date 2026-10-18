import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { Subject } from './subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepository: Repository<Subject>,
  ) {}

  async findAll(): Promise<Subject[]> {
    return this.subjectsRepository.find({
      order: {
        nameUz: 'ASC',
        id: 'ASC',
      },
    });
  }

  async create(dto: CreateSubjectDto): Promise<Subject> {
    const subject = this.subjectsRepository.create({
      code: dto.code,
      nameUz: dto.nameUz,
      nameRu: dto.nameRu ?? null,
      isActive: true,
    });

    try {
      return await this.subjectsRepository.save(subject);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === 'ER_DUP_ENTRY') {
          throw new ConflictException('Ushbu fan kodi allaqachon mavjud');
        }
      }

      throw error;
    }
  }
}
