import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDailyAttendance1790801092854 implements MigrationInterface {
    name = 'CreateDailyAttendance1790801092854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`daily_attendance\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`date\` date NOT NULL, \`pnfl\` varchar(14) NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`districtId\` int UNSIGNED NOT NULL, \`regionId\` int UNSIGNED NOT NULL, \`firstInTime\` datetime(3) NULL, \`firstInEventId\` bigint UNSIGNED NULL, \`lastOutTime\` datetime(3) NULL, \`lastOutEventId\` bigint UNSIGNED NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_daily_attendance_region_date\` (\`regionId\`, \`date\`), INDEX \`IDX_daily_attendance_district_date\` (\`districtId\`, \`date\`), INDEX \`IDX_daily_attendance_school_date\` (\`schoolId\`, \`date\`), UNIQUE INDEX \`UQ_daily_attendance_school_person_date\` (\`schoolId\`, \`pnfl\`, \`date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD CONSTRAINT \`FK_daily_attendance_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD CONSTRAINT \`FK_daily_attendance_district\` FOREIGN KEY (\`districtId\`) REFERENCES \`districts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD CONSTRAINT \`FK_daily_attendance_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD CONSTRAINT \`FK_daily_attendance_first_in\` FOREIGN KEY (\`firstInEventId\`) REFERENCES \`attendance_events\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD CONSTRAINT \`FK_daily_attendance_last_out\` FOREIGN KEY (\`lastOutEventId\`) REFERENCES \`attendance_events\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP FOREIGN KEY \`FK_daily_attendance_last_out\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP FOREIGN KEY \`FK_daily_attendance_first_in\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP FOREIGN KEY \`FK_daily_attendance_region\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP FOREIGN KEY \`FK_daily_attendance_district\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP FOREIGN KEY \`FK_daily_attendance_school\``);
        await queryRunner.query(`DROP INDEX \`UQ_daily_attendance_school_person_date\` ON \`daily_attendance\``);
        await queryRunner.query(`DROP INDEX \`IDX_daily_attendance_school_date\` ON \`daily_attendance\``);
        await queryRunner.query(`DROP INDEX \`IDX_daily_attendance_district_date\` ON \`daily_attendance\``);
        await queryRunner.query(`DROP INDEX \`IDX_daily_attendance_region_date\` ON \`daily_attendance\``);
        await queryRunner.query(`DROP TABLE \`daily_attendance\``);
    }

}
