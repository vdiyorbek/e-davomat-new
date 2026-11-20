import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolLocation1795600000000 implements MigrationInterface {
  name = 'AddSchoolLocation1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Maktab lokatsiyasi (xaritada nuqta sifatida ko‘rsatish uchun). Ustun
    // allaqachon bo‘lsa (qo‘lda qo‘shilgan) — tegilmaydi.
    if (!(await queryRunner.hasColumn('schools', 'latitude'))) {
      await queryRunner.query(
        'ALTER TABLE `schools` ADD COLUMN `latitude` decimal(9,6) NULL',
      );
    }
    if (!(await queryRunner.hasColumn('schools', 'longitude'))) {
      await queryRunner.query(
        'ALTER TABLE `schools` ADD COLUMN `longitude` decimal(9,6) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `schools` DROP COLUMN `longitude`');
    await queryRunner.query('ALTER TABLE `schools` DROP COLUMN `latitude`');
  }
}
