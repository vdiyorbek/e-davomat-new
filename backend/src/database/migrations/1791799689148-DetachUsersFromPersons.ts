import { MigrationInterface, QueryRunner } from 'typeorm';

export class DetachUsersFromPersons1791799689148 implements MigrationInterface {
  name = 'DetachUsersFromPersons1791799689148';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_person\``,
    );
    await queryRunner.query(`DROP INDEX \`UQ_users_person\` ON \`users\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`personId\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`personId\` int UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_users_person\` ON \`users\` (\`personId\`)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
