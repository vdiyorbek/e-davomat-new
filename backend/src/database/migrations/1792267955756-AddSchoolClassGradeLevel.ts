import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSchoolClassGradeLevel1792267955756 implements MigrationInterface {
    name = 'AddSchoolClassGradeLevel1792267955756'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`school_classes\` ADD \`gradeLevel\` tinyint UNSIGNED NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`school_classes\` DROP COLUMN \`gradeLevel\``);
    }

}
