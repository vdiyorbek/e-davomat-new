import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMahallaInspectors1794000000000 implements MigrationInterface {
  name = 'CreateMahallaInspectors1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum ('USER','SUPER_ADMIN','REGION_ADMIN','DISTRICT_ADMIN','SCHOOL_ADMIN','TEACHER','STUDENT','MAHALLA_INSPECTOR') NOT NULL DEFAULT 'USER'`,
    );

    await q.query(
      `CREATE TABLE \`inspector_mahallas\` (
        \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
        \`userId\` int UNSIGNED NOT NULL,
        \`mahallaId\` int UNSIGNED NOT NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`UQ_inspector_mahallas\` (\`userId\`, \`mahallaId\`),
        INDEX \`IDX_inspector_mahallas_mahalla\` (\`mahallaId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
    await q.query(
      `ALTER TABLE \`inspector_mahallas\` ADD CONSTRAINT \`FK_inspector_mahallas_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE`,
    );
    await q.query(
      `ALTER TABLE \`inspector_mahallas\` ADD CONSTRAINT \`FK_inspector_mahallas_mahalla\` FOREIGN KEY (\`mahallaId\`) REFERENCES \`mahallas\`(\`id\`) ON DELETE RESTRICT`,
    );

    await q.query(
      `CREATE TABLE \`inspector_talks\` (
        \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
        \`inspectorUserId\` int UNSIGNED NOT NULL,
        \`personId\` int UNSIGNED NOT NULL,
        \`talkDate\` date NOT NULL,
        \`spokeWith\` enum ('FATHER','MOTHER','GUARDIAN','STUDENT') NOT NULL,
        \`reason\` varchar(255) NOT NULL,
        \`result\` enum ('SOLVED','RECHECK','REFERRED') NOT NULL,
        \`note\` text NULL,
        \`followUpDate\` date NULL,
        \`pdfPath\` varchar(255) NOT NULL,
        \`pdfSha256\` char(64) NOT NULL,
        \`pdfSize\` int UNSIGNED NOT NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`IDX_inspector_talks_person\` (\`personId\`, \`talkDate\`),
        INDEX \`IDX_inspector_talks_inspector\` (\`inspectorUserId\`, \`talkDate\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
    await q.query(
      `ALTER TABLE \`inspector_talks\` ADD CONSTRAINT \`FK_inspector_talks_user\` FOREIGN KEY (\`inspectorUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT`,
    );
    await q.query(
      `ALTER TABLE \`inspector_talks\` ADD CONSTRAINT \`FK_inspector_talks_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE \`inspector_talks\``);
    await q.query(`DROP TABLE \`inspector_mahallas\``);
    // users.role enumi ataylab qaytarilmaydi: mavjud akkauntlar buziladi.
  }
}
