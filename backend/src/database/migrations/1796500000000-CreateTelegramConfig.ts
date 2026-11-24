import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTelegramConfig1796500000000 implements MigrationInterface {
  name = 'CreateTelegramConfig1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bitta qatorli jadval (id = 1). Token va maxfiy so‘z shifrlangan holda saqlanadi.
    await queryRunner.query(`
      CREATE TABLE \`telegram_config\` (
        \`id\` tinyint unsigned NOT NULL,
        \`tokenEnc\` text NULL,
        \`secretEnc\` text NULL,
        \`publicUrl\` varchar(255) NULL,
        \`updatedById\` int NULL,
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `telegram_config`');
  }
}
