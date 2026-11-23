import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePassword1796100000000 implements MigrationInterface {
  name = 'AddMustChangePassword1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD COLUMN `mustChangePassword` tinyint NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `mustChangePassword`',
    );
  }
}
