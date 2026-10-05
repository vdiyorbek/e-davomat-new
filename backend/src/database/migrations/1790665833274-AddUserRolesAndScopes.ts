import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRolesAndScopes1790665833274 implements MigrationInterface {
    name = 'AddUserRolesAndScopes1790665833274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`role\` enum ('USER', 'SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN') NOT NULL DEFAULT 'USER'`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`regionId\` int UNSIGNED NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`districtId\` int UNSIGNED NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`schoolId\` int UNSIGNED NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_district\` FOREIGN KEY (\`districtId\`) REFERENCES \`districts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_school\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_district\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_region\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`schoolId\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`districtId\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`regionId\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
    }

}
