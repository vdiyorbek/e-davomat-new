import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncements1796200000000 implements MigrationInterface {
  name = 'CreateAnnouncements1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`announcements\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`senderUserId\` int unsigned NULL,
        \`kind\` varchar(10) NOT NULL,
        \`title\` varchar(150) NOT NULL,
        \`body\` text NOT NULL,
        \`linkPath\` varchar(255) NULL,
        \`dueDate\` date NULL,
        \`audience\` json NOT NULL,
        \`recipientCount\` int unsigned NOT NULL DEFAULT 0,
        \`remindedAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_announcements_sender\` (\`senderUserId\`, \`id\`),
        KEY \`IDX_announcements_remind\` (\`kind\`, \`remindedAt\`, \`createdAt\`),
        CONSTRAINT \`FK_announcements_sender\` FOREIGN KEY (\`senderUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`announcement_recipients\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`announcementId\` int unsigned NOT NULL,
        \`userId\` int unsigned NOT NULL,
        \`notificationId\` int unsigned NULL,
        \`doneAt\` datetime(3) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_announcement_recipient\` (\`announcementId\`, \`userId\`),
        KEY \`IDX_announcement_recipients_notification\` (\`notificationId\`),
        KEY \`IDX_announcement_recipients_user\` (\`userId\`, \`doneAt\`),
        CONSTRAINT \`FK_announcement_recipients_announcement\` FOREIGN KEY (\`announcementId\`) REFERENCES \`announcements\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_announcement_recipients_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_announcement_recipients_notification\` FOREIGN KEY (\`notificationId\`) REFERENCES \`notifications\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `announcement_recipients`');
    await queryRunner.query('DROP TABLE `announcements`');
  }
}
