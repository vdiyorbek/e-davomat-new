import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueRegionName1790595445115 implements MigrationInterface {
    name = 'AddUniqueRegionName1790595445115'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`regions\` ADD UNIQUE INDEX \`IDX_1eb9a8899a7db89f6ba473fd84\` (\`name\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_regions_name\` ON \`regions\` (\`name\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_regions_name\` ON \`regions\``);
        await queryRunner.query(`ALTER TABLE \`regions\` DROP INDEX \`IDX_1eb9a8899a7db89f6ba473fd84\``);
    }

}
