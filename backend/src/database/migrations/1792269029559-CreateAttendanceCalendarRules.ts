import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAttendanceCalendarRules1792269029559 implements MigrationInterface {
    name = 'CreateAttendanceCalendarRules1792269029559'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`attendance_calendar_rules\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`startDate\` date NOT NULL, \`endDate\` date NOT NULL, \`dayType\` enum ('DAY_OFF', 'WORK_DAY') NOT NULL, \`appliesTo\` enum ('STUDENT', 'TEACHER', 'BOTH') NOT NULL DEFAULT 'BOTH', \`scopeType\` enum ('GLOBAL', 'REGION', 'DISTRICT', 'SCHOOL') NOT NULL, \`regionId\` int UNSIGNED NULL, \`districtId\` int UNSIGNED NULL, \`schoolId\` int UNSIGNED NULL, \`classId\` int UNSIGNED NULL, \`isMandatory\` tinyint NOT NULL DEFAULT 0, \`reason\` varchar(500) NOT NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdByUserId\` int UNSIGNED NOT NULL, \`updatedByUserId\` int UNSIGNED NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_calendar_rules_school_dates\` (\`schoolId\`, \`startDate\`, \`endDate\`), INDEX \`IDX_calendar_rules_district_dates\` (\`districtId\`, \`startDate\`, \`endDate\`), INDEX \`IDX_calendar_rules_region_dates\` (\`regionId\`, \`startDate\`, \`endDate\`), INDEX \`IDX_calendar_rules_scope_dates\` (\`scopeType\`, \`startDate\`, \`endDate\`, \`isActive\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_district\` FOREIGN KEY (\`districtId\`) REFERENCES \`districts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_created_by\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` ADD CONSTRAINT \`FK_calendar_rule_updated_by\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_updated_by\``);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_created_by\``);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_class\``);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_school\``);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_district\``);
        await queryRunner.query(`ALTER TABLE \`attendance_calendar_rules\` DROP FOREIGN KEY \`FK_calendar_rule_region\``);
        await queryRunner.query(`DROP INDEX \`IDX_calendar_rules_scope_dates\` ON \`attendance_calendar_rules\``);
        await queryRunner.query(`DROP INDEX \`IDX_calendar_rules_region_dates\` ON \`attendance_calendar_rules\``);
        await queryRunner.query(`DROP INDEX \`IDX_calendar_rules_district_dates\` ON \`attendance_calendar_rules\``);
        await queryRunner.query(`DROP INDEX \`IDX_calendar_rules_school_dates\` ON \`attendance_calendar_rules\``);
        await queryRunner.query(`DROP TABLE \`attendance_calendar_rules\``);
    }

}
