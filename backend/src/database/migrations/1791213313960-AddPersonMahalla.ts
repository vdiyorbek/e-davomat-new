import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPersonMahalla1791213313960 implements MigrationInterface {
    name = 'AddPersonMahalla1791213313960'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`persons\` ADD \`mahallaId\` int UNSIGNED NULL`);
        await queryRunner.query(`ALTER TABLE \`persons\` ADD CONSTRAINT \`FK_persons_mahalla\` FOREIGN KEY (\`mahallaId\`) REFERENCES \`mahallas\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`persons\` DROP FOREIGN KEY \`FK_persons_mahalla\``);
        await queryRunner.query(`ALTER TABLE \`persons\` DROP COLUMN \`mahallaId\``);
    }

}
