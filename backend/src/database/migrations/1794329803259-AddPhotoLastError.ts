import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoLastError1794329803259 implements MigrationInterface {
  name = 'AddPhotoLastError1794329803259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`attendance_events\` ADD \`photoLastError\` varchar(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`attendance_events\` DROP COLUMN \`photoLastError\``,
    );
  }
}
