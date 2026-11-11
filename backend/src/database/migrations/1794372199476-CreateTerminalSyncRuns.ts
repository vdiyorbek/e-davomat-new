import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTerminalSyncRuns1794372199476 implements MigrationInterface {
  name = 'CreateTerminalSyncRuns1794372199476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`terminal_sync_runs\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`terminalId\` int UNSIGNED NOT NULL, \`status\` enum ('SUCCESS', 'FAILED') NOT NULL, \`startedAt\` datetime(3) NOT NULL, \`finishedAt\` datetime(3) NOT NULL, \`durationMs\` int UNSIGNED NOT NULL, \`cursorBefore\` datetime(3) NULL, \`cursorAfter\` datetime(3) NULL, \`errorCode\` varchar(50) NULL, INDEX \`IDX_terminal_sync_runs_terminal_started\` (\`terminalId\`, \`startedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_terminal_sync_runs_terminal_started\` ON \`terminal_sync_runs\``,
    );
    await queryRunner.query(`DROP TABLE \`terminal_sync_runs\``);
  }
}
