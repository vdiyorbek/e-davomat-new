import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMahallas1791203983319 implements MigrationInterface {
    name = 'CreateMahallas1791203983319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`mahallas\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`districtId\` int UNSIGNED NOT NULL, \`name\` varchar(150) NOT NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_mahallas_district_name\` (\`districtId\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`mahallas\` ADD CONSTRAINT \`FK_mahallas_district\` FOREIGN KEY (\`districtId\`) REFERENCES \`districts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`mahallas\` DROP FOREIGN KEY \`FK_mahallas_district\``);
        await queryRunner.query(`DROP INDEX \`UQ_mahallas_district_name\` ON \`mahallas\``);
        await queryRunner.query(`DROP TABLE \`mahallas\``);
    }

}
