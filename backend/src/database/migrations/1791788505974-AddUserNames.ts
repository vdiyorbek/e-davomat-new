import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNames1791788505974 implements MigrationInterface {
  name = 'AddUserNames1791788505974';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`firstName\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`lastName\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`middleName\` varchar(100) NULL`,
    );
    await queryRunner.query(`
  UPDATE users AS u
  INNER JOIN persons AS p
    ON p.id = u.personId
  SET
    u.firstName = p.firstName,
    u.lastName = p.lastName,
    u.middleName = p.middleName
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`middleName\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`lastName\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`firstName\``);
  }
}
