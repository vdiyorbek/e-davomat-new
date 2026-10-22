import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLessonSessions1792686357519 implements MigrationInterface {
    name = 'CreateLessonSessions1792686357519'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`lesson_sessions\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`lessonScheduleId\` int UNSIGNED NOT NULL, \`lessonDate\` date NOT NULL, \`classId\` int UNSIGNED NOT NULL, \`teacherAssignmentId\` int UNSIGNED NOT NULL, \`lessonNumber\` tinyint UNSIGNED NOT NULL, \`startTime\` time NOT NULL, \`endTime\` time NOT NULL, \`textbookTopicId\` int UNSIGNED NULL, \`topicTitle\` varchar(255) NULL, \`homework\` text NULL, \`teacherNotes\` text NULL, \`status\` enum ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED', \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_lesson_sessions_assignment_date\` (\`teacherAssignmentId\`, \`lessonDate\`), INDEX \`IDX_lesson_sessions_class_date\` (\`classId\`, \`lessonDate\`), UNIQUE INDEX \`UQ_lesson_sessions_schedule_date\` (\`lessonScheduleId\`, \`lessonDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` ADD CONSTRAINT \`FK_lesson_sessions_schedule\` FOREIGN KEY (\`lessonScheduleId\`) REFERENCES \`lesson_schedules\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` ADD CONSTRAINT \`FK_lesson_sessions_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` ADD CONSTRAINT \`FK_lesson_sessions_assignment\` FOREIGN KEY (\`teacherAssignmentId\`) REFERENCES \`teacher_class_subjects\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` ADD CONSTRAINT \`FK_lesson_sessions_textbook_topic\` FOREIGN KEY (\`textbookTopicId\`) REFERENCES \`textbook_topics\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` DROP FOREIGN KEY \`FK_lesson_sessions_textbook_topic\``);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` DROP FOREIGN KEY \`FK_lesson_sessions_assignment\``);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` DROP FOREIGN KEY \`FK_lesson_sessions_class\``);
        await queryRunner.query(`ALTER TABLE \`lesson_sessions\` DROP FOREIGN KEY \`FK_lesson_sessions_schedule\``);
        await queryRunner.query(`DROP INDEX \`UQ_lesson_sessions_schedule_date\` ON \`lesson_sessions\``);
        await queryRunner.query(`DROP INDEX \`IDX_lesson_sessions_class_date\` ON \`lesson_sessions\``);
        await queryRunner.query(`DROP INDEX \`IDX_lesson_sessions_assignment_date\` ON \`lesson_sessions\``);
        await queryRunner.query(`DROP TABLE \`lesson_sessions\``);
    }

}
