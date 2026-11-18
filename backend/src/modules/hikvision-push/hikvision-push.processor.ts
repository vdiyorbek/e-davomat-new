import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { EventPhotoStatus } from '../attendance-events/enums/event-photo-status.enum';
import { HIKVISION_PUSH_JOB, HIKVISION_PUSH_QUEUE } from './hikvision-push.types';
import type { PushJob } from './hikvision-push.types';
import { parsePush } from './hikvision-push.parser';
import { HikvisionPushRebuildService } from './hikvision-push-rebuild.service';
@Processor(HIKVISION_PUSH_QUEUE, { concurrency: 8 })
export class HikvisionPushProcessor extends WorkerHost {
  private readonly logger = new Logger(HikvisionPushProcessor.name);

  constructor(
    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,

    @InjectRepository(AttendanceEvent)
    private readonly events: Repository<AttendanceEvent>,

    private readonly rebuildService: HikvisionPushRebuildService,
  ) {
    super();
  }

  async process(job: Job<PushJob>): Promise<void> {
    if (job.name !== HIKVISION_PUSH_JOB) throw new Error('Unexpected job name');
    const { terminalId, bodyBase64, contentType } = job.data;
    const terminal = await this.terminals.findOneBy({ id: terminalId });
    if (!terminal || !terminal.isActive || terminal.archivedAt) {
      this.logger.warn(`Terminal ${terminalId}: active terminal not found`);
      return;
    }
    const event = parsePush(contentType, Buffer.from(bodyBase64, 'base64'));
    if (!event) {
      this.logger.warn(`Terminal ${terminalId}: event body format unknown`);
      return;
    }
    if (event.eventType !== 'AccessControllerEvent' || event.major !== 5 || event.minor !== 75) return;
    if (!event.pnfl || !/^\d{14}$/.test(event.pnfl)) {
      this.logger.warn(`Terminal ${terminalId}: face event skipped, invalid PNFL`);
      return;
    }
    // Keep exactly the same verification rule as existing polling.
    if (event.verifyMode?.toLowerCase() !== 'face') {
      this.logger.warn(`Terminal ${terminalId}: face event requires currentVerifyMode=face; polling will reconcile`);
      return;
    }
    if (!event.serialNo || !/^\d{1,20}$/.test(event.serialNo) ||
      BigInt(event.serialNo) > 18446744073709551615n) {
      this.logger.warn(`Terminal ${terminalId}: invalid event serialNo`);
      return;
    }
    if (!event.time || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(event.time)) {
      this.logger.warn(`Terminal ${terminalId}: timezone missing from event`);
      return;
    }
    const eventAt = new Date(event.time);
    const eventMs = eventAt.getTime();
    if (!Number.isFinite(eventMs) || eventAt.getUTCFullYear() < 1000 ||
      eventAt.getUTCFullYear() > 9999 || eventMs > Date.now() + 300_000) {
      this.logger.warn(`Terminal ${terminalId}: invalid/future event timestamp`);
      return;
    }
    // Do not rewrite old events as 'today'. Database unique index protects
    // against concurrent polling and push duplicates.
    const photo = event.pictureURL?.trim() || null;
    const insertResult = await this.events.createQueryBuilder()
      .insert()
      .into(AttendanceEvent)
      .values({
        terminalId: terminal.id,
        schoolId: terminal.schoolId,
        pnfl: event.pnfl,
        serialNo: BigInt(event.serialNo).toString(),
        eventAt,
        direction: terminal.direction,
        major: event.major,
        minor: event.minor,
        verifyMode: 'face',
        sourcePictureUrl: photo,
        photoPath: null,
        photoStatus: photo ? EventPhotoStatus.PENDING : EventPhotoStatus.MISSING,
        photoAttempts: 0,
        photoLastAttemptAt: null,
      })
      .orIgnore()
      .execute();

    // MySQL'da yangi yozuv qo‘shilganligini aniqlaymiz.
    // MySQL INSERT IGNORE: 1 = yangi, 0 = takroriy.
    const affectedRows = Number(
      (insertResult.raw as { affectedRows?: number } | undefined)
        ?.affectedRows ?? -1,
    );

    if (affectedRows === 1) {
      this.logger.debug(
        `Push event saqlandi: terminal=${terminalId}, ` +
        `serial=${event.serialNo}`,
      );
    }

    // Takroriy event bo‘lsa ham rebuild belgisi tiklanadi.
    // Bu MySQL yozuvi muvaffaqiyatli, Redis esa vaqtincha
    // ishlamagan vaziyatni tiklashga yordam beradi.
    await this.rebuildService.schedule(
      terminal.schoolId,
      eventAt,
    );
  }
}
