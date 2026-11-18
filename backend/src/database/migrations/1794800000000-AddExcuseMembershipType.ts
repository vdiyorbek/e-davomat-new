import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sababli arizalar endi o‘qituvchilar uchun ham kiritiladi.
 * Mavjud barcha arizalar o‘quvchilarniki bo‘lgani uchun
 * standart qiymat — STUDENT.
 */
export class AddExcuseMembershipType1794800000000 implements MigrationInterface {
  name = 'AddExcuseMembershipType1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `attendance_excuses` ADD `membershipType` enum ('STUDENT', 'TEACHER') NOT NULL DEFAULT 'STUDENT' AFTER `schoolId`",
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_excuses_type_school_status` ON `attendance_excuses` (`membershipType`, `schoolId`, `status`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_excuses_type_school_status` ON `attendance_excuses`',
    );
    await queryRunner.query(
      'ALTER TABLE `attendance_excuses` DROP COLUMN `membershipType`',
    );
  }
}
