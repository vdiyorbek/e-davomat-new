import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettings1795400000000 implements MigrationInterface {
  name = 'CreateSystemSettings1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Faqat o‘zgartirilgan qiymatlar saqlanadi; qolganlari .env/kod standartidan olinadi.
    await queryRunner.query(`
      CREATE TABLE \`system_settings\` (
        \`key\` varchar(64) NOT NULL,
        \`value\` varchar(64) NOT NULL,
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        \`updatedByUserId\` int unsigned NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`system_settings_history\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`key\` varchar(64) NOT NULL,
        \`oldValue\` varchar(64) NULL,
        \`newValue\` varchar(64) NULL,
        \`changedByUserId\` int unsigned NULL,
        \`changedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_system_settings_history_changed\` (\`changedAt\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `system_settings_history`');
    await queryRunner.query('DROP TABLE `system_settings`');
  }
}
