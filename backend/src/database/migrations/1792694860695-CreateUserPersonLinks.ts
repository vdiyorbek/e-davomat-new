import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserPersonLinks1792694860695 implements MigrationInterface {
    name = 'CreateUserPersonLinks1792694860695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`user_person_links\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`userId\` int UNSIGNED NOT NULL, \`personId\` int UNSIGNED NOT NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_user_person_links_person\` (\`personId\`), UNIQUE INDEX \`UQ_user_person_links_user\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`user_person_links\` ADD CONSTRAINT \`FK_user_person_links_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_person_links\` ADD CONSTRAINT \`FK_user_person_links_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_person_links\` DROP FOREIGN KEY \`FK_user_person_links_person\``);
        await queryRunner.query(`ALTER TABLE \`user_person_links\` DROP FOREIGN KEY \`FK_user_person_links_user\``);
        await queryRunner.query(`DROP INDEX \`UQ_user_person_links_user\` ON \`user_person_links\``);
        await queryRunner.query(`DROP INDEX \`UQ_user_person_links_person\` ON \`user_person_links\``);
        await queryRunner.query(`DROP TABLE \`user_person_links\``);
    }

}
