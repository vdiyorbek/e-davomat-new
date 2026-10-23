import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMembershipDetails1792736270758 implements MigrationInterface {
    name = 'CreateMembershipDetails1792736270758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`student_membership_details\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`membershipId\` int UNSIGNED NOT NULL, \`studentNumber\` varchar(50) NULL, \`admissionOrderNumber\` varchar(100) NULL, \`educationLanguage\` varchar(50) NULL, \`educationForm\` varchar(50) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_student_membership_details_membership\` (\`membershipId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`teacher_membership_details\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`membershipId\` int UNSIGNED NOT NULL, \`employeeNumber\` varchar(50) NULL, \`position\` varchar(150) NULL, \`employmentType\` varchar(50) NULL, \`qualificationCategory\` varchar(100) NULL, \`specialization\` varchar(150) NULL, \`educationLevel\` varchar(100) NULL, \`hireOrderNumber\` varchar(100) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_teacher_membership_details_membership\` (\`membershipId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`student_membership_details\` ADD CONSTRAINT \`FK_student_membership_details_membership\` FOREIGN KEY (\`membershipId\`) REFERENCES \`school_memberships\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`teacher_membership_details\` ADD CONSTRAINT \`FK_teacher_membership_details_membership\` FOREIGN KEY (\`membershipId\`) REFERENCES \`school_memberships\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`teacher_membership_details\` DROP FOREIGN KEY \`FK_teacher_membership_details_membership\``);
        await queryRunner.query(`ALTER TABLE \`student_membership_details\` DROP FOREIGN KEY \`FK_student_membership_details_membership\``);
        await queryRunner.query(`DROP INDEX \`UQ_teacher_membership_details_membership\` ON \`teacher_membership_details\``);
        await queryRunner.query(`DROP TABLE \`teacher_membership_details\``);
        await queryRunner.query(`DROP INDEX \`UQ_student_membership_details_membership\` ON \`student_membership_details\``);
        await queryRunner.query(`DROP TABLE \`student_membership_details\``);
    }

}
