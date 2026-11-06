import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTerminalPersonSyncChecks1793970403213 implements MigrationInterface {
    name = 'CreateTerminalPersonSyncChecks1793970403213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`terminal_person_sync_checks\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`terminalId\` int UNSIGNED NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`status\` enum ('SUCCESS', 'TIMEOUT', 'ERROR') NOT NULL, \`databaseTeachers\` int UNSIGNED NULL, \`terminalUsers\` int UNSIGNED NULL, \`missingCount\` int UNSIGNED NULL, \`invalidPnfl\` int UNSIGNED NULL, \`durationMs\` int UNSIGNED NOT NULL, \`errorCode\` varchar(100) NULL, \`jobId\` varchar(100) NULL, \`checkedAt\` datetime(3) NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`IDX_person_sync_checks_status_date\` (\`status\`, \`createdAt\`), INDEX \`IDX_person_sync_checks_terminal_date\` (\`terminalId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`terminal_person_sync_checks\` ADD CONSTRAINT \`FK_cc297d01836b8da27a84fcd74ad\` FOREIGN KEY (\`terminalId\`) REFERENCES \`terminals\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminal_person_sync_checks\` DROP FOREIGN KEY \`FK_cc297d01836b8da27a84fcd74ad\``);
        await queryRunner.query(`DROP INDEX \`IDX_person_sync_checks_terminal_date\` ON \`terminal_person_sync_checks\``);
        await queryRunner.query(`DROP INDEX \`IDX_person_sync_checks_status_date\` ON \`terminal_person_sync_checks\``);
        await queryRunner.query(`DROP TABLE \`terminal_person_sync_checks\``);
    }

}
