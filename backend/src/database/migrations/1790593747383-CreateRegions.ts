import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegions1790593747383 implements MigrationInterface {
  name = 'CreateRegions1790593747383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`regions\` (
        \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
        \`name\` varchar(150) NOT NULL,
        \`createdAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `regions`');
  }
}
