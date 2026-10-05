import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSchoolMemberships1790605563836 implements MigrationInterface {
    name = 'CreateSchoolMemberships1790605563836'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`school_memberships\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`personId\` int UNSIGNED NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`type\` enum ('STUDENT', 'TEACHER') NOT NULL, \`startDate\` date NOT NULL, \`endDate\` date NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_memberships_school_type\` (\`schoolId\`, \`type\`), UNIQUE INDEX \`UQ_memberships_person_school_type_start\` (\`personId\`, \`schoolId\`, \`type\`, \`startDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` ADD CONSTRAINT \`FK_memberships_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` ADD CONSTRAINT \`FK_memberships_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`school_memberships\` DROP FOREIGN KEY \`FK_memberships_school\``);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` DROP FOREIGN KEY \`FK_memberships_person\``);
        await queryRunner.query(`DROP INDEX \`UQ_memberships_person_school_type_start\` ON \`school_memberships\``);
        await queryRunner.query(`DROP INDEX \`IDX_memberships_school_type\` ON \`school_memberships\``);
        await queryRunner.query(`DROP TABLE \`school_memberships\``);
    }

}
