import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadGatewayException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HikvisionService } from './hikvision.service';
import { TerminalCryptoService } from './terminal-crypto.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { Person } from '../persons/person.entity';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
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
    private readonly dataSource: DataSource,
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

  async checkPersonPhoto(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    const plan = await this.getPersonSyncPlan(terminalId, personId, user);

    if (
      plan.action !== 'CREATE_USER_AND_FACE' &&
      plan.action !== 'UPLOAD_FACE'
    ) {
      return {
        ...plan,
        photoFileChecked: false,
        uploadReady: false,
        photoStatus: 'NOT_REQUIRED',
      };
    }

    const person = await this.personsRepository.findOneByOrFail({
      id: personId,
    });

    // Faqat o‘zimizning profil-rasm URL formatimizga
    // mos fayllarni bevosita o‘qiymiz.
    const pattern = new RegExp(
      `^/api/persons/${personId}/photo\\?v=` +
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' +
        '[0-9a-f]{4}-[0-9a-f]{12})$',
      'i',
    );

    const match = pattern.exec(person.photoUrl ?? '');

    if (!match) {
      return {
        ...plan,
        photoFileChecked: false,
        uploadReady: false,
        photoStatus: 'LEGACY_PHOTO_PATH',
        message:
          'Rasm eski manzil formatida. Mavjud photo-check fayl aniqlash mexanizmiga ulash kerak.',
      };
    }

    const filePath = join(
      process.cwd(),
      'uploads',
      'persons',
      `${match[1]}.jpg`,
    );

    let buffer: Buffer;

    try {
      buffer = await readFile(filePath);
    } catch {
      return {
        ...plan,
        photoFileChecked: true,
        uploadReady: false,
        photoStatus: 'FILE_NOT_FOUND',
      };
    }

    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return {
        ...plan,
        photoFileChecked: true,
        uploadReady: false,
        photoStatus: 'INVALID_FILE_SIZE',
      };
    }

    try {
      const metadata = await sharp(buffer, {
        limitInputPixels: 25_000_000,
        failOn: 'warning',
      }).metadata();

      if (metadata.format !== 'jpeg' || (metadata.pages ?? 1) !== 1) {
        throw new Error('INVALID_FORMAT');
      }

      const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);

      const width = rotated ? metadata.height : metadata.width;

      const height = rotated ? metadata.width : metadata.height;

      if (
        !width ||
        !height ||
        Math.min(width, height) < 480 ||
        Math.max(width, height) < 640
      ) {
        throw new Error('INVALID_DIMENSIONS');
      }

      // Yakuniy rasmni diskka yozmaymiz.
      // Faqat xotirada Hikvision uchun tayyorlaymiz.
      const portrait = height > width;
      const targetWidth = portrait ? 480 : 640;
      const targetHeight = portrait ? 640 : 480;

      let prepared: Buffer | null = null;

      for (const quality of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
        const candidate = await sharp(buffer, {
          limitInputPixels: 25_000_000,
          failOn: 'warning',
        })
          .rotate()
          .resize(targetWidth, targetHeight, {
            fit: 'contain',
            background: '#ffffff',
          })
          .flatten({ background: '#ffffff' })
          .jpeg({
            quality,
            progressive: false,
            mozjpeg: true,
          })
          .toBuffer();

        if (candidate.length <= 199 * 1024) {
          await sharp(candidate, {
            failOn: 'warning',
          })
            .raw()
            .toBuffer();

          prepared = candidate;
          break;
        }
      }

      if (!prepared) {
        throw new Error('CONVERSION_FAILED');
      }

      return {
        ...plan,
        photoFileChecked: true,
        uploadReady: true,
        photoStatus: 'READY',
        photo: {
          originalWidth: width,
          originalHeight: height,
          preparedWidth: targetWidth,
          preparedHeight: targetHeight,
          preparedBytes: prepared.length,
          format: 'jpeg',
        },
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        ...plan,
        photoFileChecked: true,
        uploadReady: false,
        photoStatus: 'INVALID_IMAGE',
      };
    }
  }

  private async prepareSyncPhoto(person: Person): Promise<Buffer> {
    const pattern = new RegExp(
      `^/api/persons/${person.id}/photo\\?v=` +
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' +
        '[0-9a-f]{4}-[0-9a-f]{12})$',
      'i',
    );

    const match = pattern.exec(person.photoUrl ?? '');

    if (!match) {
      throw new BadRequestException('Rasm manzili standart formatda emas');
    }

    const filePath = join(
      process.cwd(),
      'uploads',
      'persons',
      `${match[1]}.jpg`,
    );

    let source: Buffer;

    try {
      source = await readFile(filePath);
    } catch {
      throw new BadRequestException('Rasm faylini o‘qib bo‘lmadi');
    }

    if (source.length === 0 || source.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Rasm fayli hajmi noto‘g‘ri');
    }

    let metadata;

    try {
      metadata = await sharp(source, {
        limitInputPixels: 25_000_000,
        failOn: 'warning',
      }).metadata();
    } catch {
      throw new BadRequestException('Rasmni o‘qib bo‘lmadi');
    }

    if (metadata.format !== 'jpeg' || (metadata.pages ?? 1) !== 1) {
      throw new BadRequestException('Rasm JPEG formatida bo‘lishi kerak');
    }

    const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);

    const width = rotated ? metadata.height : metadata.width;

    const height = rotated ? metadata.width : metadata.height;

    if (
      !width ||
      !height ||
      Math.min(width, height) < 480 ||
      Math.max(width, height) < 640
    ) {
      throw new BadRequestException('Rasmning o‘lchamlari yetarli emas');
    }

    const portrait = height > width;
    const targetWidth = portrait ? 480 : 640;
    const targetHeight = portrait ? 640 : 480;

    for (const quality of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
      const output = await sharp(source, {
        limitInputPixels: 25_000_000,
        failOn: 'warning',
      })
        .rotate()
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: '#ffffff',
        })
        .flatten({ background: '#ffffff' })
        .jpeg({
          quality,
          progressive: false,
          mozjpeg: true,
        })
        .toBuffer();

      if (output.length <= 199 * 1024) {
        await sharp(output, {
          failOn: 'warning',
        })
          .raw()
          .toBuffer();

        return output;
      }
    }

    throw new BadRequestException(
      'Rasmni Hikvision formatiga moslashtirib bo‘lmadi',
    );
  }

  private async verifyOnTerminal(
    terminal: Terminal,
    password: string,
    employeeNo: string,
  ) {
    const users = await this.hikvision.getAllTerminalUsers(terminal, password);

    const userExists = users.some((item) => item.employeeNo === employeeNo);

    const face = await this.hikvision.searchTerminalFace(
      terminal,
      password,
      employeeNo,
      '1',
    );

    return {
      userExists,
      faceExists: face.exists === true,
      faceStatus: face.status,
      verified: userExists && face.status === 'FACE_EXISTS',
    };
  }

  async syncPerson(
    terminalId: number,
    personId: number,
    user: AuthenticatedUser,
  ) {
    // Dastlabki yozish huquqi faqat SUPER_ADMIN.
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Sinxronlash uchun SUPER_ADMIN ruxsati kerak',
      );
    }

    if (
      !Number.isInteger(terminalId) ||
      terminalId <= 0 ||
      !Number.isInteger(personId) ||
      personId <= 0
    ) {
      throw new BadRequestException('Terminal yoki shaxs ID noto‘g‘ri');
    }

    // Bir necha backend process bir vaqtda ishlaganda
    // takroriy yaratishni oldini oladigan MySQL lock.
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    const lockName = `person-sync:${terminalId}:${personId}`;
    let lockAcquired = false;

    try {
      const lockRows: Array<{ acquired: number | null }> =
        await queryRunner.query('SELECT GET_LOCK(?, 0) AS acquired', [
          lockName,
        ]);

      if (Number(lockRows[0]?.acquired) !== 1) {
        throw new ConflictException(
          'Bu shaxs uchun sinxronlash allaqachon bajarilmoqda',
        );
      }

      lockAcquired = true;

      const previousSync = await this.syncRepository.findOneBy({
        terminalId,
        personId,
      });

      if (
        previousSync &&
        (previousSync.status === PersonSyncStatus.PARTIAL ||
          previousSync.status === PersonSyncStatus.FAILED ||
          previousSync.status === PersonSyncStatus.USER_CREATED ||
          previousSync.status === PersonSyncStatus.FACE_UPLOADED ||
          previousSync.status === PersonSyncStatus.VALIDATING)
      ) {
        throw new ConflictException({
          code: 'SYNC_RECONCILIATION_REQUIRED',
          message:
            'Oldingi sinxronlash yakunlanmagan. ' +
            'Terminaldagi haqiqiy holat tekshirilmasdan ' +
            'qayta yuborishga ruxsat berilmaydi.',
          terminalId,
          personId,
          storedStatus: previousSync.status,
        });
      }

      // Har safar terminalning haqiqiy holatini
      // qayta o‘qiymiz.
      const plan = await this.getPersonSyncPlan(terminalId, personId, user);

      if (plan.action === 'BLOCKED' || plan.action === 'MANUAL_REVIEW') {
        return {
          terminalId,
          personId,
          action: plan.action,
          status: 'NOT_STARTED',
          reason: plan.reason,
          wroteToTerminal: false,
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

      if (!terminal.isActive) {
        throw new BadRequestException('Terminal faol emas');
      }

      const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

      // NONE holatida ham qayta tasdiqlaymiz,
      // ammo qurilmaga hech narsa yozmaymiz.
      if (plan.action === 'NONE') {
        const verification = await this.verifyOnTerminal(
          terminal,
          password,
          person.pnfl,
        );

        if (!verification.verified) {
          return {
            terminalId,
            personId,
            action: 'MANUAL_REVIEW',
            status: 'STATE_CHANGED',
            wroteToTerminal: false,
          };
        }

        const previous = await this.syncRepository.findOneBy({
          terminalId,
          personId,
        });

        const record = this.syncRepository.create({
          ...(previous ?? {}),
          terminalId,
          personId,
          status: PersonSyncStatus.VERIFIED,
          userCreated: true,
          faceUploaded: true,
          verified: true,
          errorCode: null,
          verifiedAt: new Date(),
        });

        await this.syncRepository.save(record);

        return {
          terminalId,
          personId,
          action: 'NONE',
          status: PersonSyncStatus.VERIFIED,
          wroteToTerminal: false,
          userExists: true,
          faceExists: true,
        };
      }

      // Yozishdan oldin rasmni tayyorlash.
      // Muammo bo‘lsa terminalda hech narsa yaratilmaydi.
      const photo = await this.prepareSyncPhoto(person);

      // CREATE va UPLOAD uchun amal qilish muddatlari
      // konfiguratsiyada ochiq belgilangan bo‘lishi kerak.
      if (
        plan.action === 'CREATE_USER_AND_FACE' &&
        (!process.env.HIKVISION_USER_VALID_BEGIN ||
          !process.env.HIKVISION_USER_VALID_END)
      ) {
        throw new BadRequestException(
          'Hikvision foydalanuvchi amal qilish muddati sozlanmagan',
        );
      }

      let record = await this.syncRepository.findOneBy({
        terminalId,
        personId,
      });

      record = this.syncRepository.create({
        ...(record ?? {}),
        terminalId,
        personId,
        status: PersonSyncStatus.VALIDATING,
        verified: false,
        attempts: (record?.attempts ?? 0) + 1,
        lastAttemptAt: new Date(),
        errorCode: null,
      });

      await this.syncRepository.save(record);

      let userCreatedThisAttempt = false;
      let faceUploadedThisAttempt = false;

      try {
        if (plan.action === 'CREATE_USER_AND_FACE') {
          // Terminalda shaxs va yuzi yo‘qligi
          // qayta tasdiqlangan holat.
          await this.hikvision.createTerminalUser(terminal, password, {
            employeeNo: person.pnfl,
            name: [person.lastName, person.firstName, person.middleName]
              .filter(Boolean)
              .join(' ')
              .trim(),
            beginTime: process.env.HIKVISION_USER_VALID_BEGIN!,
            endTime: process.env.HIKVISION_USER_VALID_END!,
          });

          userCreatedThisAttempt = true;

          // Yaratishdan so‘ng terminaldan qayta o‘qiymiz.
          const users = await this.hikvision.getAllTerminalUsers(
            terminal,
            password,
          );

          if (!users.some((item) => item.employeeNo === person.pnfl)) {
            throw new Error('USER_NOT_CONFIRMED');
          }

          record.status = PersonSyncStatus.USER_CREATED;
          record.userCreated = true;

          await this.syncRepository.save(record);
        }

        // UPLOAD_FACE holatida UserInfo yaratmaymiz.
        // CREATE_USER_AND_FACE holatida esa user
        // yaratilib tekshirilganidan keyin yuz yuboriladi.
        await this.hikvision.uploadTerminalFace(terminal, password, {
          employeeNo: person.pnfl,
          fdId: '1',
          jpeg: photo,
        });

        faceUploadedThisAttempt = true;

        record.status = PersonSyncStatus.FACE_UPLOADED;
        record.faceUploaded = true;

        await this.syncRepository.save(record);

        // Qurilmadan qayta o‘qib tasdiqlash.
        const verification = await this.verifyOnTerminal(
          terminal,
          password,
          person.pnfl,
        );

        if (!verification.verified) {
          throw new Error('FINAL_VERIFICATION_FAILED');
        }

        record.status = PersonSyncStatus.VERIFIED;
        record.userCreated = verification.userExists;
        record.faceUploaded = verification.faceExists;
        record.verified = true;
        record.verifiedAt = new Date();
        record.errorCode = null;

        await this.syncRepository.save(record);

        return {
          terminalId,
          personId,
          action: plan.action,
          status: PersonSyncStatus.VERIFIED,
          wroteToTerminal: true,
          userCreatedThisAttempt,
          faceUploadedThisAttempt,
          userExists: verification.userExists,
          faceExists: verification.faceExists,
          verifiedAt: record.verifiedAt,
        };
      } catch {
        // ISAPI timeout paytida qurilma buyruqni
        // bajargan bo‘lishi mumkin.
        // Avtomatik rollback yoki qayta yuborish yo‘q.
        record.status = PersonSyncStatus.PARTIAL;
        record.verified = false;
        record.verifiedAt = null;
        record.errorCode = 'SYNC_RESULT_UNCERTAIN';

        await this.syncRepository.save(record);

        throw new BadGatewayException({
          message:
            'Sinxronlash to‘liq tasdiqlanmadi. ' +
            'Qayta yuborishdan oldin terminal holatini tekshiring.',
          code: 'SYNC_RESULT_UNCERTAIN',
          terminalId,
          personId,
        });
      }
    } finally {
      if (lockAcquired) {
        try {
          await queryRunner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } finally {
          await queryRunner.release();
        }
      } else {
        await queryRunner.release();
      }
    }
  }

  async syncMissingTeachersBatch(
    terminalId: number,
    user: AuthenticatedUser,
    options: {
      dryRun: boolean;
      limit: number;
    },
  ) {
    // Ommaviy amallar hozircha faqat SUPER_ADMIN uchun.
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Guruhli sinxronlash uchun SUPER_ADMIN kerak',
      );
    }

    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 5
    ) {
      throw new BadRequestException('Limit 1 dan 5 gacha bo‘lishi kerak');
    }

    // Maktabdagi faol o‘qituvchilarni terminal
    // bilan bir marta solishtiramiz.
    const comparison = await this.getMissingTeachers(terminalId, user);

    const selected = comparison.missing.slice(0, options.limit);

    const results: Array<{
      personId: number;
      action: string;
      status: string;
      reason?: string;
    }> = [];

    for (const item of selected) {
      // Har bir shaxsning haqiqiy holati,
      // shu jumladan yuz yozuvi va rasm fayli tekshiriladi.
      let preparation;

      try {
        preparation = await this.checkPersonPhoto(
          terminalId,
          item.personId,
          user,
        );
      } catch {
        results.push({
          personId: item.personId,
          action: 'MANUAL_REVIEW',
          status: 'CHECK_FAILED',
        });

        // Noaniq tekshiruvdan keyin davom etmaymiz.
        break;
      }

      if (!preparation.uploadReady) {
        results.push({
          personId: item.personId,
          action: preparation.action,
          status: 'SKIPPED',
          reason: preparation.photoStatus ?? preparation.reason,
        });

        continue;
      }

      if (preparation.action !== 'CREATE_USER_AND_FACE') {
        results.push({
          personId: item.personId,
          action: preparation.action,
          status: 'SKIPPED',
          reason: 'EXPECTED_CREATE_USER_AND_FACE',
        });

        continue;
      }

      if (options.dryRun) {
        results.push({
          personId: item.personId,
          action: preparation.action,
          status: 'READY',
        });

        continue;
      }

      try {
        // Bu metod ichida terminal holati qayta
        // tekshiriladi va MySQL lock olinadi.
        const result = await this.syncPerson(terminalId, item.personId, user);

        results.push({
          personId: item.personId,
          action: result.action,
          status: result.status,
        });
      } catch {
        results.push({
          personId: item.personId,
          action: preparation.action,
          status: 'FAILED_OR_UNCERTAIN',
        });

        // Xatolikdan keyin qolgan yozuvlarga
        // avtomatik o‘tmaymiz.
        break;
      }
    }

    return {
      terminalId,
      schoolId: comparison.schoolId,
      dryRun: options.dryRun,
      limit: options.limit,
      databaseTeachers: comparison.databaseTeachers,
      missingBefore: comparison.missingCount,
      selectedCount: selected.length,
      results,
      stoppedEarly: results.length < selected.length,
      // Bu maydon dastlabki solishtirish natijasi.
      // Yakuniy mavjudlik uchun API qayta chaqiriladi.
      checkedAt: new Date().toISOString(),
    };
  }

  async scanMissingTeachersForQueue(terminalId: number) {
    if (!Number.isInteger(terminalId) || terminalId <= 0) {
      throw new BadRequestException('Terminal ID noto‘g‘ri');
    }

    const terminal = await this.terminalsRepository
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.id = :terminalId', { terminalId })
      .getOne();

    if (!terminal) {
      throw new NotFoundException('Terminal topilmadi');
    }

    if (!terminal.isActive) {
      return {
        terminalId,
        schoolId: terminal.schoolId,
        skipped: true,
        reason: 'TERMINAL_INACTIVE',
        databaseTeachers: 0,
        terminalUsers: 0,
        missingCount: 0,
        missingPersonIds: [] as number[],
      };
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
      .andWhere('membership.startDate <= :today', { today })
      .andWhere('(membership.endDate IS NULL OR membership.endDate > :today)', {
        today,
      })
      .andWhere('person.deletedAt IS NULL')
      .getMany();

    const persons = new Map<number, Person>();

    for (const membership of memberships) {
      persons.set(membership.personId, membership.person);
    }

    const password = this.terminalCrypto.decrypt(terminal.passwordEncrypted);

    const startedAt = Date.now();

    console.log('PERSON SYNC SCAN START', {
      terminalId,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    });

    const terminalUsers = await this.hikvision.getAllTerminalUsers(
      terminal,
      password,
    );

    console.log('PERSON SYNC SCAN FINISHED', {
      terminalId,
      pid: process.pid,
      durationMs: Date.now() - startedAt,
      count: terminalUsers.length,
    });

    const employeeNos = new Set(terminalUsers.map((item) => item.employeeNo));

    const missingPersonIds: number[] = [];
    let invalidPnfl = 0;

    for (const person of persons.values()) {
      if (!/^\d{14}$/.test(person.pnfl)) {
        invalidPnfl++;
        continue;
      }

      if (!employeeNos.has(person.pnfl)) {
        missingPersonIds.push(person.id);
      }
    }

    missingPersonIds.sort((a, b) => a - b);

    return {
      terminalId,
      schoolId: terminal.schoolId,
      skipped: false,
      databaseTeachers: persons.size,
      terminalUsers: terminalUsers.length,
      missingCount: missingPersonIds.length,
      missingPersonIds,
      invalidPnfl,
      checkedAt: new Date().toISOString(),
    };
  }
}
