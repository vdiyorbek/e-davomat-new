import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTerminalEventActivity1795700000000 implements MigrationInterface {
  name = 'CreateTerminalEventActivity1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Push va «olish» faoliyatining soatlik yig‘masi: har terminal × manba × soat — bitta qator.
    // (Har event uchun qator yozilmaydi: 10 000 terminalda jadval to‘lib ketmasin.)
    await queryRunner.query(`
      CREATE TABLE \`terminal_event_activity\` (
        \`terminalId\` int unsigned NOT NULL,
        \`source\` enum('PUSH','AUTO_PULL','MANUAL_PULL') NOT NULL,
        \`hourStart\` datetime NOT NULL,
        \`schoolId\` int unsigned NOT NULL,
        \`received\` int unsigned NOT NULL DEFAULT 0,
        \`inserted\` int unsigned NOT NULL DEFAULT 0,
        \`duplicates\` int unsigned NOT NULL DEFAULT 0,
        \`withPicture\` int unsigned NOT NULL DEFAULT 0,
        \`withoutPicture\` int unsigned NOT NULL DEFAULT 0,
        \`maxLagSeconds\` int unsigned NOT NULL DEFAULT 0,
        \`runs\` int unsigned NOT NULL DEFAULT 0,
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`terminalId\`, \`source\`, \`hourStart\`),
        KEY \`IDX_terminal_event_activity_hour\` (\`hourStart\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `terminal_event_activity`');
  }
}
