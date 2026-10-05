import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAttendanceEvents1790797503908 implements MigrationInterface {
    name = 'CreateAttendanceEvents1790797503908'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`attendance_events\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`terminalId\` int UNSIGNED NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`pnfl\` varchar(14) NOT NULL, \`serialNo\` bigint UNSIGNED NOT NULL, \`eventAt\` datetime(3) NOT NULL, \`direction\` enum ('IN', 'OUT') NOT NULL, \`major\` int UNSIGNED NOT NULL, \`minor\` int UNSIGNED NOT NULL, \`verifyMode\` varchar(50) NULL, \`sourcePictureUrl\` text NULL, \`photoPath\` varchar(500) NULL, \`photoStatus\` enum ('PENDING', 'DOWNLOADED', 'MISSING', 'FAILED') NOT NULL DEFAULT 'PENDING', \`photoAttempts\` int UNSIGNED NOT NULL DEFAULT '0', \`photoLastAttemptAt\` datetime(3) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_attendance_events_school_time\` (\`schoolId\`, \`eventAt\`), INDEX \`IDX_attendance_events_school_person_time\` (\`schoolId\`, \`pnfl\`, \`eventAt\`), UNIQUE INDEX \`UQ_attendance_events_terminal_serial_time\` (\`terminalId\`, \`serialNo\`, \`eventAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendance_events\` ADD CONSTRAINT \`FK_attendance_events_terminal\` FOREIGN KEY (\`terminalId\`) REFERENCES \`terminals\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_events\` ADD CONSTRAINT \`FK_attendance_events_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`attendance_events\` DROP FOREIGN KEY \`FK_attendance_events_school\``);
        await queryRunner.query(`ALTER TABLE \`attendance_events\` DROP FOREIGN KEY \`FK_attendance_events_terminal\``);
        await queryRunner.query(`DROP INDEX \`UQ_attendance_events_terminal_serial_time\` ON \`attendance_events\``);
        await queryRunner.query(`DROP INDEX \`IDX_attendance_events_school_person_time\` ON \`attendance_events\``);
        await queryRunner.query(`DROP INDEX \`IDX_attendance_events_school_time\` ON \`attendance_events\``);
        await queryRunner.query(`DROP TABLE \`attendance_events\``);
    }

}
