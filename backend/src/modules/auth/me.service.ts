import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolMembership } from '../school-memberships/school-membership.entity';

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(SchoolMembership)
    private readonly membershipsRepository: Repository<SchoolMembership>,
  ) {}

  async findSchools(personId: number) {
    const memberships = await this.membershipsRepository.find({
      where: { personId },
      relations: {
        school: {
          district: {
            region: true,
          },
        },
      },
      order: {
        startDate: 'DESC',
        id: 'DESC',
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      type: membership.type,
      startDate: membership.startDate,
      endDate: membership.endDate,
      school: {
        id: membership.school.id,
        name: membership.school.name,
        district: {
          id: membership.school.district.id,
          name: membership.school.district.name,
        },
        region: {
          id: membership.school.district.region.id,
          name: membership.school.district.region.name,
        },
      },
    }));
  }
}
