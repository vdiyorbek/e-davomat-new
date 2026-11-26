import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentEventPhotosFlag1796600000000 implements MigrationInterface {
  name = 'AddParentEventPhotosFlag1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Maktab bo‘yicha: ota-onaga terminal rasmini ko‘rsatish (standart — o‘chiq).
    await queryRunner.query(
      'ALTER TABLE `parent_notification_schools` ADD COLUMN `showEventPhotos` tinyint(1) NOT NULL DEFAULT 0 AFTER `graceMinutes`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `parent_notification_schools` DROP COLUMN `showEventPhotos`',
    );
  }
}
