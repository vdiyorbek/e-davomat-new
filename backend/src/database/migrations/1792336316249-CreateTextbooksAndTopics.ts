import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTextbooksAndTopics1792336316249 implements MigrationInterface {
    name = 'CreateTextbooksAndTopics1792336316249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`textbooks\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`subjectId\` int UNSIGNED NOT NULL, \`gradeLevel\` tinyint UNSIGNED NOT NULL, \`title\` varchar(255) NOT NULL, \`languageCode\` varchar(12) NOT NULL, \`publisher\` varchar(200) NULL, \`publicationYear\` smallint UNSIGNED NULL, \`approvalReference\` varchar(300) NULL, \`isVerified\` tinyint NOT NULL DEFAULT 0, \`fileStorageKey\` varchar(500) NULL, \`fileSha256\` char(64) NULL, \`pageCount\` int UNSIGNED NULL, \`processingStatus\` enum ('DRAFT', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'DRAFT', \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_textbooks_subject_grade_language\` (\`subjectId\`, \`gradeLevel\`, \`languageCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`textbook_topics\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`textbookId\` int UNSIGNED NOT NULL, \`orderIndex\` int UNSIGNED NOT NULL, \`chapterTitle\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`pageStart\` int UNSIGNED NULL, \`pageEnd\` int UNSIGNED NULL, \`source\` enum ('GEMINI', 'MANUAL') NOT NULL DEFAULT 'GEMINI', \`reviewStatus\` enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW', \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_textbook_topics_textbook_review\` (\`textbookId\`, \`reviewStatus\`), UNIQUE INDEX \`UQ_textbook_topics_textbook_order\` (\`textbookId\`, \`orderIndex\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`textbooks\` ADD CONSTRAINT \`FK_textbooks_subject\` FOREIGN KEY (\`subjectId\`) REFERENCES \`curriculum_subjects\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`textbook_topics\` ADD CONSTRAINT \`FK_textbook_topics_textbook\` FOREIGN KEY (\`textbookId\`) REFERENCES \`textbooks\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`textbook_topics\` DROP FOREIGN KEY \`FK_textbook_topics_textbook\``);
        await queryRunner.query(`ALTER TABLE \`textbooks\` DROP FOREIGN KEY \`FK_textbooks_subject\``);
        await queryRunner.query(`DROP INDEX \`UQ_textbook_topics_textbook_order\` ON \`textbook_topics\``);
        await queryRunner.query(`DROP INDEX \`IDX_textbook_topics_textbook_review\` ON \`textbook_topics\``);
        await queryRunner.query(`DROP TABLE \`textbook_topics\``);
        await queryRunner.query(`DROP INDEX \`IDX_textbooks_subject_grade_language\` ON \`textbooks\``);
        await queryRunner.query(`DROP TABLE \`textbooks\``);
    }

}
