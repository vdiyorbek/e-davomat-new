import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthSessions1790692848277 implements MigrationInterface {
    name = 'CreateAuthSessions1790692848277'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`auth_sessions\` (\`id\` varchar(36) NOT NULL, \`userId\` int UNSIGNED NOT NULL, \`refreshTokenHash\` char(64) NOT NULL, \`expiresAt\` datetime(3) NOT NULL, \`revokedAt\` datetime(3) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_auth_sessions_expires\` (\`expiresAt\`), INDEX \`IDX_auth_sessions_user\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`auth_sessions\` ADD CONSTRAINT \`FK_auth_sessions_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`auth_sessions\` DROP FOREIGN KEY \`FK_auth_sessions_user\``);
        await queryRunner.query(`DROP INDEX \`IDX_auth_sessions_user\` ON \`auth_sessions\``);
        await queryRunner.query(`DROP INDEX \`IDX_auth_sessions_expires\` ON \`auth_sessions\``);
        await queryRunner.query(`DROP TABLE \`auth_sessions\``);
    }

}
