import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTeacherClassSubjects1792327054027 implements MigrationInterface {
    name = 'CreateTeacherClassSubjects1792327054027'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`teacher_class_subjects\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`teacherMembershipId\` int UNSIGNED NOT NULL, \`classId\` int UNSIGNED NOT NULL, \`subjectId\` int UNSIGNED NOT NULL, \`startDate\` date NOT NULL, \`endDate\` date NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_tcs_teacher_membership\` (\`teacherMembershipId\`), INDEX \`IDX_tcs_class_subject\` (\`classId\`, \`subjectId\`), UNIQUE INDEX \`UQ_tcs_teacher_class_subject_start\` (\`teacherMembershipId\`, \`classId\`, \`subjectId\`, \`startDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` ADD CONSTRAINT \`FK_tcs_teacher_membership\` FOREIGN KEY (\`teacherMembershipId\`) REFERENCES \`school_memberships\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` ADD CONSTRAINT \`FK_tcs_school_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` ADD CONSTRAINT \`FK_tcs_subject\` FOREIGN KEY (\`subjectId\`) REFERENCES \`curriculum_subjects\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` DROP FOREIGN KEY \`FK_tcs_subject\``);
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` DROP FOREIGN KEY \`FK_tcs_school_class\``);
        await queryRunner.query(`ALTER TABLE \`teacher_class_subjects\` DROP FOREIGN KEY \`FK_tcs_teacher_membership\``);
        await queryRunner.query(`DROP INDEX \`UQ_tcs_teacher_class_subject_start\` ON \`teacher_class_subjects\``);
        await queryRunner.query(`DROP INDEX \`IDX_tcs_class_subject\` ON \`teacher_class_subjects\``);
        await queryRunner.query(`DROP INDEX \`IDX_tcs_teacher_membership\` ON \`teacher_class_subjects\``);
        await queryRunner.query(`DROP TABLE \`teacher_class_subjects\``);
    }

}
