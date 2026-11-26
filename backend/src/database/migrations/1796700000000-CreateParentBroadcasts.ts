import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateParentBroadcasts1796700000000 implements MigrationInterface {
  name = 'CreateParentBroadcasts1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bosh administrator veb-saytdan ota-onalarga yuboradigan e'lon va xabarlar.
    await queryRunner.query(`
      CREATE TABLE \`parent_broadcasts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`type\` varchar(16) NOT NULL,
        \`texts\` json NOT NULL,
        \`audience\` json NOT NULL,
        \`urgent\` tinyint NOT NULL DEFAULT 0,
        \`createdByUserId\` int unsigned NULL,
        \`canceledAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_parent_broadcasts_created\` (\`createdAt\`)
      ) ENGINE=InnoDB
    `);
    // Ota-ona e'lonlarni o'chirib qo'ya oladi (standart — yoqiq).
    await queryRunner.query(
      'ALTER TABLE `parent_telegram_links` ADD COLUMN `notifyNews` tinyint NOT NULL DEFAULT 1 AFTER `notifyExcuse`',
    );
    // Xabar bo'yicha hisobot (yuborildi/kutmoqda) tez chiqishi uchun.
    await queryRunner.query(
      'ALTER TABLE `parent_messages` ADD KEY `IDX_parent_messages_dedupe` (`dedupeKey`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `parent_messages` DROP KEY `IDX_parent_messages_dedupe`',
    );
    await queryRunner.query(
      'ALTER TABLE `parent_telegram_links` DROP COLUMN `notifyNews`',
    );
    await queryRunner.query('DROP TABLE `parent_broadcasts`');
  }
}
