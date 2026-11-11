import { MigrationInterface, QueryRunner } from 'typeorm';

/** Terminal holatlari tarixi: faqat holat o‘zgargan davrlar saqlanadi. */
export class CreateTerminalStatusPeriods1794600000000 implements MigrationInterface {
  name = 'CreateTerminalStatusPeriods1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `terminal_status_periods` (' +
        '`id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, ' +
        '`terminalId` int UNSIGNED NOT NULL, ' +
        "`status` enum ('ONLINE', 'OFFLINE') NOT NULL, " +
        '`startedAt` datetime(3) NOT NULL, ' +
        '`endedAt` datetime(3) NULL, ' +
        '`lastCheckAt` datetime(3) NOT NULL, ' +
        '`checks` int UNSIGNED NOT NULL DEFAULT 1, ' +
        '`failedChecks` int UNSIGNED NOT NULL DEFAULT 0, ' +
        '`lastError` varchar(255) NULL, ' +
        'INDEX `IDX_terminal_status_periods_terminal_started` (`terminalId`, `startedAt`), ' +
        'INDEX `IDX_terminal_status_periods_terminal_open` (`terminalId`, `endedAt`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `terminal_status_periods`');
  }
}
