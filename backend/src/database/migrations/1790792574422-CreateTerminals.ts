import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTerminals1790792574422 implements MigrationInterface {
    name = 'CreateTerminals1790792574422'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`terminals\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`name\` varchar(150) NOT NULL, \`schoolId\` int UNSIGNED NOT NULL, \`direction\` enum ('IN', 'OUT') NOT NULL, \`protocol\` enum ('HTTP', 'HTTPS') NOT NULL DEFAULT 'HTTP', \`host\` varchar(253) NOT NULL, \`port\` smallint UNSIGNED NOT NULL DEFAULT '80', \`username\` varchar(100) NOT NULL, \`passwordEncrypted\` text NOT NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`model\` varchar(100) NULL, \`serialNumber\` varchar(150) NULL, \`lastCheckedAt\` datetime(3) NULL, \`lastSuccessfulSyncAt\` datetime(3) NULL, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`IDX_terminals_school_active\` (\`schoolId\`, \`isActive\`), UNIQUE INDEX \`UQ_terminals_host_port\` (\`host\`, \`port\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`terminals\` ADD CONSTRAINT \`FK_terminals_school\` FOREIGN KEY (\`schoolId\`) REFERENCES \`schools\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`terminals\` DROP FOREIGN KEY \`FK_terminals_school\``);
        await queryRunner.query(`DROP INDEX \`UQ_terminals_host_port\` ON \`terminals\``);
        await queryRunner.query(`DROP INDEX \`IDX_terminals_school_active\` ON \`terminals\``);
        await queryRunner.query(`DROP TABLE \`terminals\``);
    }

}
