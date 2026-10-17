import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAttendanceWeeklySchedules1792268496070 implements MigrationInterface {
    name = 'CreateAttendanceWeeklySchedules1792268496070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`attendance_weekly_schedules\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`schoolId\` int UNSIGNED NOT NULL, \`academicYear\` varchar(9) NOT NULL, \`membershipType\` enum ('STUDENT', 'TEACHER') NOT NULL, \`gradeFrom\` tinyint UNSIGNED NULL, \`gradeTo\` tinyint UNSIGNED NULL, \`classId\` int UNSIGNED NULL, \`workingDaysMask\` tinyint UNSIGNED NOT NULL, \`effectiveFrom\` date NOT NULL, \`effectiveTo\` date NULL, \`createdByUserId\` int UNSIGNED NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_weekly_schedule_school_dates\` (\`schoolId\`, \`effectiveFrom\`, \`effectiveTo\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` ADD CONSTRAINT \`FK_weekly_schedule_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` ADD CONSTRAINT \`FK_weekly_schedule_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` ADD CONSTRAINT \`FK_weekly_schedule_created_by\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` DROP FOREIGN KEY \`FK_weekly_schedule_created_by\``);
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` DROP FOREIGN KEY \`FK_weekly_schedule_class\``);
        await queryRunner.query(`ALTER TABLE \`attendance_weekly_schedules\` DROP FOREIGN KEY \`FK_weekly_schedule_school\``);
        await queryRunner.query(`DROP INDEX \`IDX_weekly_schedule_school_dates\` ON \`attendance_weekly_schedules\``);
        await queryRunner.query(`DROP TABLE \`attendance_weekly_schedules\``);
    }

}
