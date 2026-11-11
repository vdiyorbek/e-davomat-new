import { MigrationInterface, QueryRunner } from 'typeorm';

/** Terminal xotirasini tozalash amallari tarixi. */
export class CreateTerminalClearRuns1794700000000 implements MigrationInterface {
  name = 'CreateTerminalClearRuns1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `terminal_clear_runs` (' +
        '`id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, ' +
        '`terminalId` int UNSIGNED NOT NULL, ' +
        '`requestedByUserId` int UNSIGNED NULL, ' +
        '`jobId` varchar(100) NULL, ' +
        '`status` varchar(20) NOT NULL, ' +
        '`usersBefore` int UNSIGNED NULL, ' +
        '`usersAfter` int UNSIGNED NULL, ' +
        '`facesAfter` int UNSIGNED NULL, ' +
        '`errorCode` varchar(50) NULL, ' +
        '`errorMessage` varchar(255) NULL, ' +
        '`createdAt` datetime(3) NOT NULL, ' +
        '`startedAt` datetime(3) NULL, ' +
        '`finishedAt` datetime(3) NULL, ' +
        'INDEX `IDX_terminal_clear_runs_created` (`createdAt`), ' +
        'INDEX `IDX_terminal_clear_runs_terminal_created` (`terminalId`, `createdAt`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `terminal_clear_runs`');
  }
}
