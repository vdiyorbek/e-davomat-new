import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLogin1790606224414 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD \`login\` varchar(50) NULL
    `);

    await queryRunner.query(`
      UPDATE \`users\`
      SET \`login\` = CONCAT('user_', \`id\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`users\`
      MODIFY \`login\` varchar(50) NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX \`UQ_users_login\`
      ON \`users\` (\`login\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX \`UQ_users_login\` ON \`users\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`users\` DROP COLUMN \`login\`
    `);
  }
}
