import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonSyncHistory1794400000000 implements MigrationInterface {
  name = 'CreatePersonSyncHistory1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE person_sync_batches (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        requestedByUserId INT UNSIGNED NULL,
        type VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUING',
        terminalCount INT UNSIGNED NOT NULL DEFAULT 0,
        totalItems INT UNSIGNED NOT NULL DEFAULT 0,
        queuedItems INT UNSIGNED NOT NULL DEFAULT 0,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        finishedAt DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX IDX_ps_batches_date (createdAt),
        INDEX IDX_ps_batches_status_date (status, createdAt),
        CONSTRAINT FK_ps_batches_user
          FOREIGN KEY (requestedByUserId)
          REFERENCES users(id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE person_sync_batch_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        batchId BIGINT UNSIGNED NOT NULL,
        terminalId INT UNSIGNED NOT NULL,
        personId INT UNSIGNED NOT NULL,
        jobId VARCHAR(150) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        errorCode VARCHAR(100) NULL,
        startedAt DATETIME(3) NULL,
        finishedAt DATETIME(3) NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX UQ_ps_item_batch_terminal_person
          (batchId, terminalId, personId),
        INDEX IDX_ps_item_batch_status (batchId, status),
        INDEX IDX_ps_item_terminal_date (terminalId, createdAt),
        INDEX IDX_ps_item_job (jobId),
        CONSTRAINT FK_ps_item_batch
          FOREIGN KEY (batchId)
          REFERENCES person_sync_batches(id)
          ON DELETE CASCADE,
        CONSTRAINT FK_ps_item_terminal
          FOREIGN KEY (terminalId)
          REFERENCES terminals(id)
          ON DELETE RESTRICT,
        CONSTRAINT FK_ps_item_person
          FOREIGN KEY (personId)
          REFERENCES persons(id)
          ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE person_sync_batch_items');

    await queryRunner.query('DROP TABLE person_sync_batches');
  }
}
