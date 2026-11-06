import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';
import {
  SchoolMembership,
  MembershipType,
} from '../school-memberships/school-membership.entity';

import { Terminal } from './terminal.entity';
import { TerminalPersonSync } from './terminal-person-sync.entity';
import { PersonSyncStatus } from './enums/person-sync-status.enum';

@Injectable()
export class PersonSyncService {
  constructor(
    @InjectRepository(Terminal)
    private readonly terminalsRepository: Repository<Terminal>,

    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,

    @InjectRepository(SchoolMembership)
    private readonly membershipsRepository: Repository<SchoolMembership>,

    @InjectRepository(TerminalPersonSync)
    private readonly syncRepository: Repository<TerminalPersonSync>,
  ) {}

  private todayInTashkent(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value;

    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  async previewPerson(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    if (
      !Number.isInteger(terminalId) ||
      terminalId <= 0 ||
      !Number.isInteger(personId) ||
      personId <= 0
    ) {
      throw new BadRequestException('Terminal yoki shaxs ID noto‘g‘ri');
    }

    // 1. Terminal va uning hududiy ma'lumotlari.
    const terminal = await this.terminalsRepository.findOne({
      where: { id: terminalId },
      relations: {
        school: {
          district: {
            region: true,
          },
        },
      },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    // 2. Administratorning hududiy vakolatlari.
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (
          !user.regionId ||
          terminal.school.district.region.id !== user.regionId
        ) {
          throw new ForbiddenException('Ushbu viloyat terminaliga ruxsat yo‘q');
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (
          !user.districtId ||
          terminal.school.district.id !== user.districtId
        ) {
          throw new ForbiddenException('Ushbu tuman terminaliga ruxsat yo‘q');
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || terminal.schoolId !== user.schoolId) {
          throw new ForbiddenException('Ushbu maktab terminaliga ruxsat yo‘q');
        }
        break;

      default:
        throw new ForbiddenException(
          'Sinxronlash ma’lumotlarini ko‘rishga ruxsat yo‘q',
        );
    }

    // 3. Shaxs.
    const person = await this.personsRepository.findOneBy({
      id: personId,
    });

    if (!person) {
      throw new NotFoundException('Shaxs topilmadi');
    }

    // 4. Maktabdagi faol a'zolik.
    const today = this.todayInTashkent();

    const memberships = await this.membershipsRepository
      .createQueryBuilder('membership')
      .where('membership.personId = :personId', {
        personId,
      })
      .andWhere('membership.schoolId = :schoolId', {
        schoolId: terminal.schoolId,
      })
      .andWhere('membership.startDate <= :today', {
        today,
      })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('membership.type IN (:...types)', {
        types: [MembershipType.STUDENT, MembershipType.TEACHER],
      })
      .getMany();

    const membershipTypes = [...new Set(memberships.map((m) => m.type))];

    const activeMembership = membershipTypes.length > 0;

    // 5. Avvalgi sinxronlash holati.
    const sync = await this.syncRepository.findOneBy({
      terminalId,
      personId,
    });

    const validPnfl = /^\d{14}$/.test(person.pnfl);
    const hasPhotoUrl = Boolean(person.photoUrl?.trim());

    const checks = {
      terminalActive: terminal.isActive,
      personActive: true,
      activeMembership,
      validPnfl,
      hasPhotoUrl,
    };

    const issues: string[] = [];

    if (!checks.terminalActive) {
      issues.push('TERMINAL_INACTIVE');
    }

    if (!checks.activeMembership) {
      issues.push('NO_ACTIVE_MEMBERSHIP');
    }

    if (!checks.validPnfl) {
      issues.push('INVALID_PNFL');
    }

    if (!checks.hasPhotoUrl) {
      issues.push('PHOTO_URL_MISSING');
    }

    const databaseReady = issues.length === 0;

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      personId: person.id,

      membershipTypes,

      checks,

      databaseReady,

      // Qurilmadagi haqiqiy holat bu yerda hali
      // tekshirilmagan.
      terminalUserChecked: false,
      terminalFaceChecked: false,
      photoFileChecked: false,

      sync: sync
        ? {
            status: sync.status,
            userCreated: sync.userCreated,
            faceUploaded: sync.faceUploaded,
            verified: sync.verified,
            attempts: sync.attempts,
            errorCode: sync.errorCode,
            lastAttemptAt: sync.lastAttemptAt,
            verifiedAt: sync.verifiedAt,
          }
        : {
            status: PersonSyncStatus.PENDING,
            userCreated: false,
            faceUploaded: false,
            verified: false,
            attempts: 0,
            errorCode: null,
            lastAttemptAt: null,
            verifiedAt: null,
          },

      issues,
      checkedAt: new Date().toISOString(),
    };
  }
}
