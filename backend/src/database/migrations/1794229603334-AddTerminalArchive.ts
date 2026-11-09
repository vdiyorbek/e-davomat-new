import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTerminalArchive1794229603334 implements MigrationInterface {
    name = 'AddTerminalArchive1794229603334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminals\` ADD \`archivedAt\` datetime(3) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminals\` DROP COLUMN \`archivedAt\``);
    }

}
