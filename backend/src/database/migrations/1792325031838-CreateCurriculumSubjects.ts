import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCurriculumSubjects1792325031838 implements MigrationInterface {
    name = 'CreateCurriculumSubjects1792325031838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`curriculum_subjects\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`code\` varchar(40) NOT NULL, \`nameUz\` varchar(150) NOT NULL, \`nameRu\` varchar(150) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_curriculum_subjects_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_curriculum_subjects_code\` ON \`curriculum_subjects\``);
        await queryRunner.query(`DROP TABLE \`curriculum_subjects\``);
    }

}
