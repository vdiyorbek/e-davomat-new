import { MigrationInterface, QueryRunner } from 'typeorm';

/** Terminalga yuborilgan shaxslarning holati (entity: TerminalPersonSync). */
export class CreateTerminalPersonSync1793970403216 implements MigrationInterface {
  name = 'CreateTerminalPersonSync1793970403216';

  public async up(q: QueryRunner): Promise<void> {
    // Jadval boshqa yo'l bilan yaratilgan bazalarda xato bermasligi uchun.
    const exists = await q.hasTable('terminal_person_sync');
    if (exists) return;

    await q.query(
      `CREATE TABLE \`terminal_person_sync\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`terminalId\` int UNSIGNED NOT NULL,
        \`personId\` int UNSIGNED NOT NULL,
        \`status\` enum ('PENDING','VALIDATING','USER_CREATED','FACE_UPLOADED','VERIFIED','PARTIAL','FAILED') NOT NULL DEFAULT 'PENDING',
        \`userCreated\` tinyint NOT NULL DEFAULT 0,
        \`faceUploaded\` tinyint NOT NULL DEFAULT 0,
        \`verified\` tinyint NOT NULL DEFAULT 0,
        \`attempts\` int UNSIGNED NOT NULL DEFAULT 0,
        \`errorCode\` varchar(100) NULL,
        \`lastAttemptAt\` datetime(3) NULL,
        \`verifiedAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`UQ_terminal_person_sync_terminal_person\` (\`terminalId\`, \`personId\`),
        INDEX \`IDX_terminal_person_sync_status\` (\`status\`, \`updatedAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
    await q.query(
      `ALTER TABLE \`terminal_person_sync\` ADD CONSTRAINT \`FK_terminal_person_sync_terminal\` FOREIGN KEY (\`terminalId\`) REFERENCES \`terminals\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE \`terminal_person_sync\` ADD CONSTRAINT \`FK_terminal_person_sync_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable('terminal_person_sync'))) return;
    await q.query(
      `ALTER TABLE \`terminal_person_sync\` DROP FOREIGN KEY \`FK_terminal_person_sync_person\``,
    );
    await q.query(
      `ALTER TABLE \`terminal_person_sync\` DROP FOREIGN KEY \`FK_terminal_person_sync_terminal\``,
    );
    await q.query(`DROP TABLE \`terminal_person_sync\``);
  }
}
