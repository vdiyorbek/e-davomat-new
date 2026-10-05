import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDistricts1790596240535 implements MigrationInterface {
    name = 'CreateDistricts1790596240535'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_1eb9a8899a7db89f6ba473fd84\` ON \`regions\``);
        await queryRunner.query(`CREATE TABLE \`districts\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`name\` varchar(150) NOT NULL, \`regionId\` int UNSIGNED NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_districts_region_name\` (\`regionId\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`districts\` ADD CONSTRAINT \`FK_districts_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`districts\` DROP FOREIGN KEY \`FK_districts_region\``);
        await queryRunner.query(`DROP INDEX \`UQ_districts_region_name\` ON \`districts\``);
        await queryRunner.query(`DROP TABLE \`districts\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_1eb9a8899a7db89f6ba473fd84\` ON \`regions\` (\`name\`)`);
    }

}
