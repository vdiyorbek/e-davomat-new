import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTerminalSyncCursor1790831407092 implements MigrationInterface {
    name = 'AddTerminalSyncCursor1790831407092'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminals\` ADD \`syncStartAt\` datetime(3) NULL`);
        await queryRunner.query(`ALTER TABLE \`terminals\` ADD \`eventsSyncedUntil\` datetime(3) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminals\` DROP COLUMN \`eventsSyncedUntil\``);
        await queryRunner.query(`ALTER TABLE \`terminals\` DROP COLUMN \`syncStartAt\``);
    }

}
