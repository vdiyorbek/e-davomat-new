import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerminalHttpPush1795000000000
  implements MigrationInterface
{
  name = 'AddTerminalHttpPush1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`terminals\`
        ADD COLUMN \`pushEnabled\` tinyint(1)
          NOT NULL DEFAULT 0,
        ADD COLUMN \`pushTokenHash\` char(64)
          CHARACTER SET ascii COLLATE ascii_bin NULL,
        ADD COLUMN \`pushLastReceivedAt\` datetime(3) NULL,
        ADD COLUMN \`pushLastEventAt\` datetime(3) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX \`UQ_terminals_push_token_hash\`
      ON \`terminals\` (\`pushTokenHash\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX \`UQ_terminals_push_token_hash\`
      ON \`terminals\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`terminals\`
        DROP COLUMN \`pushLastEventAt\`,
        DROP COLUMN \`pushLastReceivedAt\`,
        DROP COLUMN \`pushTokenHash\`,
        DROP COLUMN \`pushEnabled\`
    `);
  }
}
