import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherWorkloadAndAssessments1795100000000 implements MigrationInterface {
  name = 'TeacherWorkloadAndAssessments1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // O‘quv rejasi bo‘yicha haftalik soat (masalan, 5A matematika — 5 soat).
    await queryRunner.query(`
      ALTER TABLE \`teacher_class_subjects\`
        ADD COLUMN \`weeklyHours\` tinyint unsigned NULL
    `);

    await queryRunner.query(`
      CREATE TABLE \`assessments\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`teacherAssignmentId\` int unsigned NOT NULL,
        \`schoolId\` int unsigned NOT NULL,
        \`classId\` int unsigned NOT NULL,
        \`subjectId\` int unsigned NOT NULL,
        \`type\` enum('CHSB','BSB') NOT NULL,
        \`quarter\` tinyint unsigned NULL,
        \`title\` varchar(255) NOT NULL,
        \`status\` enum('GENERATING','DRAFT','PUBLISHED','CLOSED','FAILED') NOT NULL DEFAULT 'GENERATING',
        \`topicIds\` json NOT NULL,
        \`questionCount\` tinyint unsigned NOT NULL,
        \`difficulty\` enum('EASY','MEDIUM','HARD') NOT NULL DEFAULT 'MEDIUM',
        \`durationMinutes\` smallint unsigned NOT NULL DEFAULT 40,
        \`startsAt\` datetime(3) NULL,
        \`endsAt\` datetime(3) NULL,
        \`aiModel\` varchar(100) NULL,
        \`generationError\` varchar(500) NULL,
        \`createdByUserId\` int unsigned NOT NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_assessments_assignment\` (\`teacherAssignmentId\`, \`createdAt\`),
        KEY \`IDX_assessments_class_status\` (\`classId\`, \`status\`),
        CONSTRAINT \`FK_assessments_assignment\` FOREIGN KEY (\`teacherAssignmentId\`)
          REFERENCES \`teacher_class_subjects\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_assessments_class\` FOREIGN KEY (\`classId\`)
          REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`CHK_assessments_quarter\` CHECK (\`quarter\` IS NULL OR \`quarter\` BETWEEN 1 AND 4)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`assessment_questions\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`assessmentId\` int unsigned NOT NULL,
        \`orderIndex\` smallint unsigned NOT NULL,
        \`text\` text NOT NULL,
        \`options\` json NOT NULL,
        \`correctIndex\` tinyint unsigned NOT NULL,
        \`explanation\` text NULL,
        \`topicId\` int unsigned NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_assessment_questions_order\` (\`assessmentId\`, \`orderIndex\`),
        CONSTRAINT \`FK_assessment_questions_assessment\` FOREIGN KEY (\`assessmentId\`)
          REFERENCES \`assessments\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`assessment_attempts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`assessmentId\` int unsigned NOT NULL,
        \`personId\` int unsigned NOT NULL,
        \`startedAt\` datetime(3) NOT NULL,
        \`deadlineAt\` datetime(3) NOT NULL,
        \`submittedAt\` datetime(3) NULL,
        \`answers\` json NULL,
        \`correctCount\` smallint unsigned NULL,
        \`totalCount\` smallint unsigned NOT NULL,
        \`percent\` decimal(5,2) NULL,
        \`grade\` tinyint unsigned NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_assessment_attempts_person\` (\`assessmentId\`, \`personId\`),
        CONSTRAINT \`FK_assessment_attempts_assessment\` FOREIGN KEY (\`assessmentId\`)
          REFERENCES \`assessments\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_assessment_attempts_person\` FOREIGN KEY (\`personId\`)
          REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `assessment_attempts`');
    await queryRunner.query('DROP TABLE IF EXISTS `assessment_questions`');
    await queryRunner.query('DROP TABLE IF EXISTS `assessments`');
    await queryRunner.query(
      'ALTER TABLE `teacher_class_subjects` DROP COLUMN `weeklyHours`',
    );
  }
}
