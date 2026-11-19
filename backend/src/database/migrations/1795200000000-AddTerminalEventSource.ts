import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerminalEventSource1795200000000 implements MigrationInterface {
  name = 'AddTerminalEventSource1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mavjud terminallar avvalgidek polling’da qoladi — hech narsa to‘xtamaydi.
    await queryRunner.query(`
      ALTER TABLE \`terminals\`
        ADD COLUMN \`eventSource\` enum('PUSH','POLLING')
          NOT NULL DEFAULT 'POLLING'
    `);

    // Push tokeni allaqachon yoqilgan terminallar — push rejimida.
    await queryRunner.query(`
      UPDATE \`terminals\` SET \`eventSource\` = 'PUSH'
       WHERE \`pushEnabled\` = 1 AND \`pushTokenHash\` IS NOT NULL
    `);

    // Yangi qo‘shiladigan terminallar uchun standart — PUSH.
    await queryRunner.query(`
      ALTER TABLE \`terminals\`
        ALTER COLUMN \`eventSource\` SET DEFAULT 'PUSH'
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_terminals_event_source\`
        ON \`terminals\` (\`eventSource\`, \`isActive\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_terminals_event_source` ON `terminals`',
    );
    await queryRunner.query(
      'ALTER TABLE `terminals` DROP COLUMN `eventSource`',
    );
  }
}
