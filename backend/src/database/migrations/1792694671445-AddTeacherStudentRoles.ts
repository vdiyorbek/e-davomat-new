import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherStudentRoles1792694671445 implements MigrationInterface {
    name = 'AddTeacherStudentRoles1792694671445'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('USER', 'SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT') NOT NULL DEFAULT 'USER'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`role\` \`role\` enum ('USER', 'SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN') NOT NULL DEFAULT 'USER'`);
    }

}
