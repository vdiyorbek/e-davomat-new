import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HikvisionService } from './hikvision.service';
import { TerminalCryptoService } from './terminal-crypto.service';
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

    private readonly hikvision: HikvisionService,
    private readonly terminalCrypto: TerminalCryptoService,
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

  async checkTerminalPerson(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    // Hududiy vakolat va maktab a'zoligini tekshirish.
    const preview = await this.previewPerson(terminalId, personId, user);

    if (!preview.databaseReady) {
      return {
        ...preview,
        terminalUserChecked: false,
        terminalUserExists: null,
        message: 'Shaxs dastlabki tekshiruvdan o‘tmadi',
      };
    }

    const person = await this.personsRepository.findOneByOrFail({
      id: personId,
    });

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOneOrFail();

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    // Terminaldagi barcha foydalanuvchilarni o‘qiymiz.
    const terminalUsers = await this.hikvision.getAllTerminalUsers(
      terminal,
      password,
    );

    const existingUser = terminalUsers.find(
      (item) => item.employeeNo === person.pnfl,
    );

    return {
      ...preview,
      terminalUserChecked: true,
      terminalUserExists: Boolean(existingUser),
      terminalUserStatus: existingUser ? 'USER_EXISTS' : 'MISSING_USER',
      terminalFaceChecked: false,
      photoFileChecked: false,
      checkedAt: new Date().toISOString(),
    };
  }

  async checkTerminalPersonFace(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    const preview = await this.checkTerminalPerson(terminalId, personId, user);

    // Bazadagi ma'lumotlar noto‘g‘ri yoki terminal
    // foydalanuvchilari tekshirilmagan bo‘lsa, to‘xtaymiz.
    if (!preview.databaseReady || preview.terminalUserChecked !== true) {
      return {
        ...preview,
        terminalFaceChecked: false,
        terminalFaceExists: null,
        terminalFaceStatus: 'NOT_CHECKED',
      };
    }

    const person = await this.personsRepository.findOneByOrFail({
      id: personId,
    });

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', {
        terminalId,
      })
      .getOneOrFail();

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    // Endi USER_EXISTS bo‘lmasa ham,
    // yuz kutubxonasini mustaqil tekshiramiz.
    const faceResult = await this.hikvision.searchTerminalFace(
      terminal,
      password,
      person.pnfl,
      '1',
    );

    return {
      ...preview,
      terminalFaceChecked: faceResult.checked,
      terminalFaceExists: faceResult.exists,
      terminalFaceStatus: faceResult.status,
      faceLibrary: {
        fdId: faceResult.fdId,
        faceLibType: 'blackFD',
      },
      faceSearch: {
        responseStatus: faceResult.responseStatus,
        totalMatches: faceResult.totalMatches,
        responseFields: faceResult.responseFields,
        matchFields: faceResult.matchFields,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  async getPersonSyncPlan(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    const result = await this.checkTerminalPersonFace(
      terminalId,
      personId,
      user,
    );

    type SyncAction =
      | 'NONE'
      | 'CREATE_USER_AND_FACE'
      | 'UPLOAD_FACE'
      | 'BLOCKED'
      | 'MANUAL_REVIEW';

    let action: SyncAction = 'MANUAL_REVIEW';
    let reason = 'TERMINAL_STATUS_UNKNOWN';

    if (!result.databaseReady) {
      action = 'BLOCKED';
      reason = 'DATABASE_NOT_READY';
    } else if (!result.terminalUserChecked) {
      reason = 'USER_NOT_CHECKED';
    } else if (!result.terminalFaceChecked) {
      reason = 'FACE_NOT_CHECKED';
    } else if (
      result.terminalUserExists === true &&
      result.terminalFaceStatus === 'FACE_EXISTS'
    ) {
      action = 'NONE';
      reason = 'ALREADY_EXISTS';
    } else if (
      result.terminalUserExists === false &&
      result.terminalFaceStatus === 'MISSING_FACE'
    ) {
      action = 'CREATE_USER_AND_FACE';
      reason = 'USER_AND_FACE_MISSING';
    } else if (
      result.terminalUserExists === true &&
      result.terminalFaceStatus === 'MISSING_FACE'
    ) {
      action = 'UPLOAD_FACE';
      reason = 'FACE_MISSING';
    } else if (
      result.terminalUserExists === false &&
      result.terminalFaceStatus === 'FACE_EXISTS'
    ) {
      action = 'MANUAL_REVIEW';
      reason = 'ORPHAN_FACE_RECORD';
    } else {
      action = 'MANUAL_REVIEW';
      reason = 'FACE_STATUS_UNKNOWN';
    }

    const requiresPhotoValidation =
      action === 'CREATE_USER_AND_FACE' || action === 'UPLOAD_FACE';

    return {
      terminalId,
      personId,
      action,
      reason,
      databaseReady: result.databaseReady,
      terminalUserExists: result.terminalUserExists,
      terminalFaceExists: result.terminalFaceExists,
      terminalFaceStatus: result.terminalFaceStatus,
      faceLibrary: 'faceLibrary' in result ? result.faceLibrary : null,
      photoFileChecked: false,
      uploadReady: false,
      requiresPhotoValidation,
      storedSyncStatus: result.sync.status,
      checkedAt: new Date().toISOString(),
    };
  }

  async getMissingTeachers(terminalId: number, user: AuthenticatedUser) {
    if (!Number.isInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('Terminal ID noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .innerJoinAndSelect('terminal.school', 'school')
      .innerJoinAndSelect('school.district', 'district')
      .innerJoinAndSelect('district.region', 'region')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    // Administratorning hududiy vakolatlarini tekshiramiz.
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        break;

      case UserRole.REGION_ADMIN:
        if (
          !user.regionId ||
          terminal.school.district.region.id !== user.regionId
        ) {
          throw new ForbiddenException('Viloyatga ruxsat yo‘q');
        }
        break;

      case UserRole.DISTRICT_ADMIN:
        if (
          !user.districtId ||
          terminal.school.district.id !== user.districtId
        ) {
          throw new ForbiddenException('Tumanga ruxsat yo‘q');
        }
        break;

      case UserRole.SCHOOL_ADMIN:
        if (!user.schoolId || terminal.schoolId !== user.schoolId) {
          throw new ForbiddenException('Maktabga ruxsat yo‘q');
        }
        break;

      default:
        throw new ForbiddenException('Ruxsat yo‘q');
    }

    if (!terminal.isActive) {
      throw new BadRequestException('Terminal faol emas');
    }

    const today = this.todayInTashkent();

    const memberships = await this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.person', 'person')
      .where('membership.schoolId = :schoolId', {
        schoolId: terminal.schoolId,
      })
      .andWhere('membership.type = :type', {
        type: MembershipType.TEACHER,
      })
      .andWhere('membership.startDate <= :today', {
        today,
      })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('person.deletedAt IS NULL')
      .getMany();

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    // Terminaldagi foydalanuvchilarni bir marta o‘qiymiz.
    const terminalUsers = await this.hikvision.getAllTerminalUsers(
      terminal,
      password,
    );

    const employeeNos = new Set(terminalUsers.map((item) => item.employeeNo));

    const uniquePersons = new Map<number, Person>();

    for (const membership of memberships) {
      uniquePersons.set(membership.person.id, membership.person);
    }

    const missing: Array<{
      personId: number;
      hasPhotoUrl: boolean;
      status: string;
    }> = [];

    let invalidPnfl = 0;

    for (const person of uniquePersons.values()) {
      if (!/^\d{14}$/.test(person.pnfl)) {
        invalidPnfl++;
        continue;
      }

      if (!employeeNos.has(person.pnfl)) {
        missing.push({
          personId: person.id,
          hasPhotoUrl: Boolean(person.photoUrl?.trim()),
          status: 'MISSING_USER',
        });
      }
    }

    missing.sort((a, b) => a.personId - b.personId);

    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      schoolId: terminal.schoolId,
      databaseTeachers: uniquePersons.size,
      terminalUsers: terminalUsers.length,
      missingCount: missing.length,
      invalidPnfl,
      missing,
      checkedAt: new Date().toISOString(),
    };
  }
}
