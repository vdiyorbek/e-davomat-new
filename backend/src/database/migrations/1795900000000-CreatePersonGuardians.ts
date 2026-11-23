import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonGuardians1795900000000 implements MigrationInterface {
  name = 'CreatePersonGuardians1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`person_guardians\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`personId\` int unsigned NOT NULL,
        \`relation\` enum('FATHER','MOTHER') NOT NULL,
        \`lastName\` varchar(100) NULL,
        \`firstName\` varchar(100) NULL,
        \`middleName\` varchar(100) NULL,
        \`phoneNumber\` varchar(20) NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_person_guardians_person_relation\` (\`personId\`, \`relation\`),
        CONSTRAINT \`FK_person_guardians_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `person_guardians`');
  }
}
