import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerminalHealth1794226641174 implements MigrationInterface {
  name = 'AddTerminalHealth1794226641174';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`terminals\` ADD \`lastSeenAt\` datetime(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`terminals\` ADD \`lastError\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`terminals\` ADD \`consecutiveFailures\` int UNSIGNED NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`terminals\` DROP COLUMN \`consecutiveFailures\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`terminals\` DROP COLUMN \`lastError\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`terminals\` DROP COLUMN \`lastSeenAt\``,
    );
  }
}
