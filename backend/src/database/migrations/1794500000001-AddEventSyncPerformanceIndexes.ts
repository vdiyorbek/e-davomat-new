import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Eventlarni olish va monitoring so‘rovlari uchun indekslar.
 *
 *  • attendance_events (terminalId, eventAt)
 *      — /terminals/monitoring: terminalning bugungi eventlari.
 *        Avval faqat (terminalId, serialNo, eventAt) bor edi va MySQL
 *        terminalning butun tarixini ko‘rib chiqardi.
 *  • attendance_events (terminalId, photoStatus)
 *      — terminal bo‘yicha foto statistikasi va yuklanmagan rasmlar.
 *  • attendance_events (photoStatus, terminalId)
 *      — foto sinxronlash rejalashtiruvchisi (har daqiqa): PENDING/FAILED
 *        rasmli terminallarni butun jadvalni skanerlamasdan topadi.
 *  • terminal_sync_runs (startedAt)
 *      — «Sinxronlash tarixi» sahifasi: filtrsiz saralash.
 *
 * InnoDB’da ALGORITHM=INPLACE, LOCK=NONE — jadval yozuvlari bloklanmaydi.
 */
export class AddEventSyncPerformanceIndexes1794500000001 implements MigrationInterface {
  name = 'AddEventSyncPerformanceIndexes1794500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `attendance_events` ' +
        'ADD INDEX `IDX_attendance_events_terminal_time` (`terminalId`, `eventAt`), ' +
        'ADD INDEX `IDX_attendance_events_terminal_photo` (`terminalId`, `photoStatus`), ' +
        'ADD INDEX `IDX_attendance_events_photo_terminal` (`photoStatus`, `terminalId`), ' +
        'ALGORITHM=INPLACE, LOCK=NONE',
    );

    await queryRunner.query(
      'ALTER TABLE `terminal_sync_runs` ' +
        'ADD INDEX `IDX_terminal_sync_runs_started` (`startedAt`), ' +
        'ALGORITHM=INPLACE, LOCK=NONE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `terminal_sync_runs` DROP INDEX `IDX_terminal_sync_runs_started`',
    );

    await queryRunner.query(
      'ALTER TABLE `attendance_events` ' +
        'DROP INDEX `IDX_attendance_events_photo_terminal`, ' +
        'DROP INDEX `IDX_attendance_events_terminal_photo`, ' +
        'DROP INDEX `IDX_attendance_events_terminal_time`',
    );
  }
}
