import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import type {
  GuardianInputDto,
  SaveGuardiansDto,
} from './dto/save-guardians.dto';
import { GuardianRelation, PersonGuardian } from './person-guardian.entity';
import { PersonsService } from './persons.service';

export interface GuardianView {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  phoneNumber: string | null;
}

export interface GuardiansView {
  father: GuardianView | null;
  mother: GuardianView | null;
}

function isEmpty(input: GuardianInputDto | null | undefined): boolean {
  return (
    !input ||
    (!input.lastName &&
      !input.firstName &&
      !input.middleName &&
      !input.phoneNumber)
  );
}

@Injectable()
export class PersonGuardiansService {
  constructor(
    @InjectRepository(PersonGuardian)
    private readonly repository: Repository<PersonGuardian>,
    private readonly persons: PersonsService,
  ) {}

  private view(row: PersonGuardian | undefined): GuardianView | null {
    return row
      ? {
          lastName: row.lastName,
          firstName: row.firstName,
          middleName: row.middleName,
          phoneNumber: row.phoneNumber,
        }
      : null;
  }

  async get(personId: number, user: AuthenticatedUser): Promise<GuardiansView> {
    // Ko‘rish huquqi shaxsning o‘zini ko‘rish bilan bir xil (hudud/maktab bo‘yicha).
    await this.persons.findOne(personId, user);
    const rows = await this.repository.find({ where: { personId } });
    return {
      father: this.view(
        rows.find((r) => r.relation === GuardianRelation.FATHER),
      ),
      mother: this.view(
        rows.find((r) => r.relation === GuardianRelation.MOTHER),
      ),
    };
  }

  async save(
    personId: number,
    dto: SaveGuardiansDto,
    user: AuthenticatedUser,
  ): Promise<GuardiansView> {
    await this.persons.findOne(personId, user);

    if (dto.father === undefined && dto.mother === undefined) {
      throw new BadRequestException('Ota yoki ona ma’lumotini yuboring');
    }

    const apply = async (
      relation: GuardianRelation,
      input: GuardianInputDto | null | undefined,
    ) => {
      if (input === undefined) return;
      if (isEmpty(input)) {
        await this.repository.delete({ personId, relation });
        return;
      }
      await this.repository.upsert(
        {
          personId,
          relation,
          lastName: input?.lastName ?? null,
          firstName: input?.firstName ?? null,
          middleName: input?.middleName ?? null,
          phoneNumber: input?.phoneNumber ?? null,
        },
        ['personId', 'relation'],
      );
    };

    await apply(GuardianRelation.FATHER, dto.father);
    await apply(GuardianRelation.MOTHER, dto.mother);
    return this.get(personId, user);
  }
}
