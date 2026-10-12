import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSchoolClasses1791220692825 implements MigrationInterface {
    name = 'CreateSchoolClasses1791220692825'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`school_classes\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`schoolId\` int UNSIGNED NOT NULL, \`academicYear\` varchar(9) NOT NULL, \`name\` varchar(30) NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_school_classes_school_year_name\` (\`schoolId\`, \`academicYear\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` ADD \`classId\` int UNSIGNED NULL`);
        await queryRunner.query(`ALTER TABLE \`school_classes\` ADD CONSTRAINT \`FK_school_classes_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` ADD CONSTRAINT \`FK_memberships_class\` FOREIGN KEY (\`classId\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`school_memberships\` DROP FOREIGN KEY \`FK_memberships_class\``);
        await queryRunner.query(`ALTER TABLE \`school_classes\` DROP FOREIGN KEY \`FK_school_classes_school\``);
        await queryRunner.query(`ALTER TABLE \`school_memberships\` DROP COLUMN \`classId\``);
        await queryRunner.query(`DROP INDEX \`UQ_school_classes_school_year_name\` ON \`school_classes\``);
        await queryRunner.query(`DROP TABLE \`school_classes\``);
    }

}
