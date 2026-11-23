import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeroomExcuseApprovalNotifications1796000000000
  implements MigrationInterface
{
  name = 'HomeroomExcuseApprovalNotifications1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sinf rahbari: sinfga biriktirilgan o‘qituvchi (shaxs).
    await queryRunner.query(`
      ALTER TABLE \`school_classes\`
        ADD COLUMN \`homeroomPersonId\` int unsigned NULL,
        ADD KEY \`IDX_school_classes_homeroom\` (\`homeroomPersonId\`),
        ADD CONSTRAINT \`FK_school_classes_homeroom\` FOREIGN KEY (\`homeroomPersonId\`)
          REFERENCES \`persons\` (\`id\`) ON DELETE SET NULL
    `);

    // Ariza tasdiqlash: PENDING (kutilmoqda) va REJECTED (rad etilgan).
    await queryRunner.query(`
      ALTER TABLE \`attendance_excuses\`
        MODIFY \`status\` enum('ACTIVE','CANCELLED','PENDING','REJECTED') NOT NULL DEFAULT 'ACTIVE',
        ADD COLUMN \`reviewedByUserId\` int unsigned NULL,
        ADD COLUMN \`reviewedAt\` datetime(3) NULL,
        ADD COLUMN \`rejectionReason\` varchar(500) NULL,
        ADD CONSTRAINT \`FK_excuses_reviewed_by\` FOREIGN KEY (\`reviewedByUserId\`)
          REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`userId\` int unsigned NOT NULL,
        \`type\` varchar(50) NOT NULL,
        \`payload\` json NULL,
        \`dedupeKey\` varchar(120) NULL,
        \`readAt\` datetime(3) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_notifications_user_dedupe\` (\`userId\`, \`dedupeKey\`),
        KEY \`IDX_notifications_user_read\` (\`userId\`, \`readAt\`, \`id\`),
        CONSTRAINT \`FK_notifications_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `notifications`');
    await queryRunner.query(`
      ALTER TABLE \`attendance_excuses\`
        DROP FOREIGN KEY \`FK_excuses_reviewed_by\`,
        DROP COLUMN \`reviewedByUserId\`,
        DROP COLUMN \`reviewedAt\`,
        DROP COLUMN \`rejectionReason\`
    `);
    await queryRunner.query(`
      UPDATE \`attendance_excuses\` SET \`status\` = 'CANCELLED' WHERE \`status\` IN ('PENDING','REJECTED')
    `);
    await queryRunner.query(`
      ALTER TABLE \`attendance_excuses\`
        MODIFY \`status\` enum('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE \`school_classes\`
        DROP FOREIGN KEY \`FK_school_classes_homeroom\`,
        DROP KEY \`IDX_school_classes_homeroom\`,
        DROP COLUMN \`homeroomPersonId\`
    `);
  }
}
