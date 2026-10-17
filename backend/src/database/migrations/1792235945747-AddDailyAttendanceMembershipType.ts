import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDailyAttendanceMembershipType1792235945747 implements MigrationInterface {
    name = 'AddDailyAttendanceMembershipType1792235945747'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_daily_attendance_school_person_date\` ON \`daily_attendance\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` ADD \`membershipType\` enum ('STUDENT', 'TEACHER') NOT NULL DEFAULT 'STUDENT'`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_daily_attendance_school_person_date_type\` ON \`daily_attendance\` (\`schoolId\`, \`pnfl\`, \`date\`, \`membershipType\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_daily_attendance_school_person_date_type\` ON \`daily_attendance\``);
        await queryRunner.query(`ALTER TABLE \`daily_attendance\` DROP COLUMN \`membershipType\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_daily_attendance_school_person_date\` ON \`daily_attendance\` (\`schoolId\`, \`pnfl\`, \`date\`)`);
    }

}
