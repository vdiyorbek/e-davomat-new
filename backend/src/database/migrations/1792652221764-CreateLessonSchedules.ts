import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLessonSchedules1792652221764 implements MigrationInterface {
    name = 'CreateLessonSchedules1792652221764'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`lesson_schedules\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`classId\` int UNSIGNED NOT NULL, \`teacherAssignmentId\` int UNSIGNED NOT NULL, \`dayOfWeek\` tinyint UNSIGNED NOT NULL, \`lessonNumber\` tinyint UNSIGNED NOT NULL, \`startTime\` time NOT NULL, \`endTime\` time NOT NULL, \`startDate\` date NOT NULL, \`endDate\` date NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_lesson_schedules_teacher_assignment\` (\`teacherAssignmentId\`), INDEX \`IDX_lesson_schedules_class_day\` (\`classId\`, \`dayOfWeek\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`lesson_schedules\` ADD CONSTRAINT \`FK_lesson_schedules_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_schedules\` ADD CONSTRAINT \`FK_lesson_schedules_assignment\` FOREIGN KEY (\`teacherAssignmentId\`) REFERENCES \`teacher_class_subjects\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lesson_schedules\` DROP FOREIGN KEY \`FK_lesson_schedules_assignment\``);
        await queryRunner.query(`ALTER TABLE \`lesson_schedules\` DROP FOREIGN KEY \`FK_lesson_schedules_class\``);
        await queryRunner.query(`DROP INDEX \`IDX_lesson_schedules_class_day\` ON \`lesson_schedules\``);
        await queryRunner.query(`DROP INDEX \`IDX_lesson_schedules_teacher_assignment\` ON \`lesson_schedules\``);
        await queryRunner.query(`DROP TABLE \`lesson_schedules\``);
    }

}
