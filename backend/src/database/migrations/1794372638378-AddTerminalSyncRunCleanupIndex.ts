import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTerminalSyncRunCleanupIndex1794372638378 implements MigrationInterface {
    name = 'AddTerminalSyncRunCleanupIndex1794372638378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_terminal_sync_runs_finished_at\` ON \`terminal_sync_runs\` (\`finishedAt\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_terminal_sync_runs_finished_at\` ON \`terminal_sync_runs\``);
    }

}
