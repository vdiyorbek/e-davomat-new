import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAttendanceExcuses1791979970704 implements MigrationInterface {
    name = 'CreateAttendanceExcuses1791979970704'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`attendance_excuses\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`personId\` int UNSIGNED NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`reason\` enum ('ILLNESS', 'OLYMPIAD', 'FAMILY', 'OTHER') NOT NULL, \`reasonNote\` varchar(500) NULL, \`startDate\` date NOT NULL, \`endDate\` date NOT NULL, \`status\` enum ('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE', \`pdfPath\` varchar(500) NOT NULL, \`pdfOriginalName\` varchar(255) NOT NULL, \`pdfSize\` int UNSIGNED NOT NULL, \`pdfSha256\` char(64) NOT NULL, \`uploadedByUserId\` int UNSIGNED NOT NULL, \`cancelledByUserId\` int UNSIGNED NULL, \`cancelledAt\` datetime(3) NULL, \`cancellationReason\` varchar(500) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_excuses_person_dates\` (\`personId\`, \`startDate\`, \`endDate\`), INDEX \`IDX_excuses_school_status_dates\` (\`schoolId\`, \`status\`, \`startDate\`, \`endDate\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` ADD CONSTRAINT \`FK_excuses_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` ADD CONSTRAINT \`FK_excuses_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` ADD CONSTRAINT \`FK_excuses_uploaded_by\` FOREIGN KEY (\`uploadedByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` ADD CONSTRAINT \`FK_excuses_cancelled_by\` FOREIGN KEY (\`cancelledByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` DROP FOREIGN KEY \`FK_excuses_cancelled_by\``);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` DROP FOREIGN KEY \`FK_excuses_uploaded_by\``);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` DROP FOREIGN KEY \`FK_excuses_school\``);
        await queryRunner.query(`ALTER TABLE \`attendance_excuses\` DROP FOREIGN KEY \`FK_excuses_person\``);
        await queryRunner.query(`DROP INDEX \`IDX_excuses_school_status_dates\` ON \`attendance_excuses\``);
        await queryRunner.query(`DROP INDEX \`IDX_excuses_person_dates\` ON \`attendance_excuses\``);
        await queryRunner.query(`DROP TABLE \`attendance_excuses\``);
    }

}
