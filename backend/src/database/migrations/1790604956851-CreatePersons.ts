import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePersons1790604956851 implements MigrationInterface {
    name = 'CreatePersons1790604956851'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`persons\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`pnfl\` varchar(14) NOT NULL, \`firstName\` varchar(100) NOT NULL, \`lastName\` varchar(100) NOT NULL, \`middleName\` varchar(100) NULL, \`gender\` enum ('MALE', 'FEMALE') NULL, \`nationality\` varchar(100) NULL, \`birthDate\` date NULL, \`address\` varchar(500) NULL, \`phoneNumber\` varchar(20) NULL, \`photoUrl\` varchar(500) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), \`deletedAt\` datetime(3) NULL, UNIQUE INDEX \`UQ_persons_pnfl\` (\`pnfl\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_persons_pnfl\` ON \`persons\``);
        await queryRunner.query(`DROP TABLE \`persons\``);
    }

}
