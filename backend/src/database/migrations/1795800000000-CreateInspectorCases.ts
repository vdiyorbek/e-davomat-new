import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInspectorCases1795800000000 implements MigrationInterface {
  name = 'CreateInspectorCases1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`inspector_cases\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`inspectorUserId\` int unsigned NOT NULL,
        \`personId\` int unsigned NOT NULL,
        \`schoolId\` int unsigned NOT NULL,
        \`classId\` int unsigned NULL,
        \`absentSince\` date NOT NULL,
        \`absentDays\` smallint unsigned NOT NULL,
        \`status\` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
        \`visitDate\` date NULL,
        \`spokeWith\` enum('FATHER','MOTHER','GUARDIAN','STUDENT','NEIGHBOR','NOT_MET') NULL,
        \`reason\` enum('ILLNESS','FAMILY','MIGRATED','WORKING','NO_INTEREST','NOT_FOUND','OTHER') NULL,
        \`findings\` text NULL,
        \`actionsTaken\` text NULL,
        \`outcome\` enum('RETURNED','EXCUSED','REFERRED','TRANSFERRED','STILL_ABSENT') NULL,
        \`followUpDate\` date NULL,
        \`closedAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_inspector_cases_inspector\` (\`inspectorUserId\`, \`status\`),
        KEY \`IDX_inspector_cases_person\` (\`personId\`, \`status\`),
        CONSTRAINT \`FK_inspector_cases_user\` FOREIGN KEY (\`inspectorUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_inspector_cases_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `inspector_cases`');
  }
}
