import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { Subject } from './subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepository: Repository<Subject>,
  ) {}

  // READ: barcha fanlar
  async findAll(): Promise<Subject[]> {
    return this.subjectsRepository.find({
      order: {
        nameUz: 'ASC',
        id: 'ASC',
      },
    });
  }

  // READ: bitta fan
  async findOne(id: number): Promise<Subject> {
    const subject = await this.subjectsRepository.findOneBy({
      id,
    });

    if (!subject) {
      throw new NotFoundException('Fan topilmadi');
    }

    return subject;
  }

  // CREATE
  async create(dto: CreateSubjectDto): Promise<Subject> {
    const subject = this.subjectsRepository.create({
      code: dto.code,
      nameUz: dto.nameUz,
      nameRu: dto.nameRu ?? null,
      isActive: true,
    });

    return this.saveSubject(subject);
  }

  // UPDATE
  async update(id: number, dto: UpdateSubjectDto): Promise<Subject> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('O‘zgartiriladigan ma’lumot yuborilmagan');
    }

    const subject = await this.findOne(id);

    if (dto.code !== undefined) {
      subject.code = dto.code;
    }

    if (dto.nameUz !== undefined) {
      subject.nameUz = dto.nameUz;
    }

    if (dto.nameRu !== undefined) {
      subject.nameRu = dto.nameRu;
    }

    if (dto.isActive !== undefined) {
      subject.isActive = dto.isActive;
    }

    return this.saveSubject(subject);
  }

  // DELETE: xavfsiz arxivlash
  async archive(id: number): Promise<Subject> {
    const subject = await this.findOne(id);

    if (!subject.isActive) {
      return subject;
    }

    subject.isActive = false;

    return this.saveSubject(subject);
  }

  // Bazaga yozish va duplicate code xatolarini tekshirish
  private async saveSubject(subject: Subject): Promise<Subject> {
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
