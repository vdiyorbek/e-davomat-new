import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sinxronlash tarixiga terminaldan olingan va yangi saqlangan
 * eventlar sonini qo‘shadi. Eski yozuvlar uchun 0.
 */
export class AddTerminalSyncRunEventCounts1794500000000 implements MigrationInterface {
  name = 'AddTerminalSyncRunEventCounts1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `terminal_sync_runs` ' +
        'ADD `fetchedEvents` int UNSIGNED NOT NULL DEFAULT 0, ' +
        'ADD `insertedEvents` int UNSIGNED NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `terminal_sync_runs` ' +
        'DROP COLUMN `insertedEvents`, ' +
        'DROP COLUMN `fetchedEvents`',
    );
  }
}
