import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateParentTelegram1796400000000 implements MigrationInterface {
  name = 'CreateParentTelegram1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Telefon bo‘yicha tez qidirish: raqamning oxirgi 9 ta raqami (+998 / 8 / bo‘shliqlarsiz).
    await queryRunner.query(`
      ALTER TABLE \`person_guardians\`
        ADD COLUMN \`phoneKey\` varchar(9) GENERATED ALWAYS AS (
          CASE WHEN CHAR_LENGTH(REGEXP_REPLACE(\`phoneNumber\`, '[^0-9]', '')) >= 9
               THEN RIGHT(REGEXP_REPLACE(\`phoneNumber\`, '[^0-9]', ''), 9)
               ELSE NULL END
        ) STORED,
        ADD KEY \`IDX_person_guardians_phoneKey\` (\`phoneKey\`)
    `);

    await queryRunner.query(`
      CREATE TABLE \`parent_notification_schools\` (
        \`schoolId\` int unsigned NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`defaultAbsentTime\` time NOT NULL DEFAULT '09:30:00',
        \`graceMinutes\` smallint unsigned NOT NULL DEFAULT 30,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`schoolId\`),
        CONSTRAINT \`FK_parent_schools_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`parent_telegram_links\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`telegramUserId\` bigint unsigned NOT NULL,
        \`chatId\` bigint NOT NULL,
        \`phoneKey\` varchar(9) NULL,
        \`language\` varchar(8) NOT NULL DEFAULT 'uz',
        \`notifyArrival\` tinyint NOT NULL DEFAULT 1,
        \`notifyLeave\` tinyint NOT NULL DEFAULT 1,
        \`notifyAbsent\` tinyint NOT NULL DEFAULT 1,
        \`notifyExcuse\` tinyint NOT NULL DEFAULT 1,
        \`blockedAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_parent_links_telegram\` (\`telegramUserId\`),
        KEY \`IDX_parent_links_phone\` (\`phoneKey\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`parent_messages\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`linkId\` int unsigned NOT NULL,
        \`kind\` varchar(16) NOT NULL,
        \`personId\` int unsigned NOT NULL,
        \`dedupeKey\` varchar(80) NOT NULL,
        \`payload\` json NULL,
        \`status\` varchar(8) NOT NULL DEFAULT 'PENDING',
        \`attempts\` tinyint unsigned NOT NULL DEFAULT 0,
        \`sendAfter\` datetime(3) NOT NULL,
        \`sentAt\` datetime(3) NULL,
        \`error\` varchar(200) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_parent_messages_dedupe\` (\`linkId\`, \`dedupeKey\`),
        KEY \`IDX_parent_messages_queue\` (\`status\`, \`sendAfter\`),
        KEY \`IDX_parent_messages_created\` (\`createdAt\`),
        CONSTRAINT \`FK_parent_messages_link\` FOREIGN KEY (\`linkId\`) REFERENCES \`parent_telegram_links\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `parent_messages`');
    await queryRunner.query('DROP TABLE `parent_telegram_links`');
    await queryRunner.query('DROP TABLE `parent_notification_schools`');
    await queryRunner.query(
      'ALTER TABLE `person_guardians` DROP KEY `IDX_person_guardians_phoneKey`, DROP COLUMN `phoneKey`',
    );
  }
}
