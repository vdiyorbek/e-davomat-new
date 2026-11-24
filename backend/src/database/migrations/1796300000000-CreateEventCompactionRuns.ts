import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventCompactionRuns1796300000000 implements MigrationInterface {
  name = 'CreateEventCompactionRuns1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`event_compaction_runs\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`trigger\` varchar(10) NOT NULL,
        \`status\` varchar(10) NOT NULL,
        \`startedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`finishedAt\` datetime(3) NULL,
        \`deletedRows\` bigint unsigned NOT NULL DEFAULT 0,
        \`deletedFiles\` bigint unsigned NOT NULL DEFAULT 0,
        \`throughDay\` date NULL,
        \`keepDays\` int unsigned NOT NULL,
        \`startedByUserId\` int unsigned NULL,
        \`error\` varchar(255) NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_event_compaction_runs_started\` (\`startedAt\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `event_compaction_runs`');
  }
}
