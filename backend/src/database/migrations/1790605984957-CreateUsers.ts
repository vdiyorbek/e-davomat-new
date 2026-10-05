import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1790605984957 implements MigrationInterface {
    name = 'CreateUsers1790605984957'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`personId\` int UNSIGNED NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE INDEX \`UQ_users_person\` (\`personId\`), UNIQUE INDEX \`REL_ddd0d20e45dbd0d1536dc08203\` (\`personId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_users_person\` FOREIGN KEY (\`personId\`) REFERENCES \`persons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_person\``);
        await queryRunner.query(`DROP INDEX \`REL_ddd0d20e45dbd0d1536dc08203\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`UQ_users_person\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
