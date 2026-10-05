import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSchools1790602098159 implements MigrationInterface {
    name = 'CreateSchools1790602098159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`schools\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`name\` varchar(200) NOT NULL, \`districtId\` int UNSIGNED NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_schools_district_name\` (\`districtId\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`schools\` ADD CONSTRAINT \`FK_schools_district\` FOREIGN KEY (\`districtId\`) REFERENCES \`districts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`schools\` DROP FOREIGN KEY \`FK_schools_district\``);
        await queryRunner.query(`DROP INDEX \`UQ_schools_district_name\` ON \`schools\``);
        await queryRunner.query(`DROP TABLE \`schools\``);
    }

}
