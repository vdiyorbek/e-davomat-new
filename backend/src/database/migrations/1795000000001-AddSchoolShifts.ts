
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolShifts1795000000001
    implements MigrationInterface {
    name = 'AddSchoolShifts1795000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE \`school_shifts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`schoolId\` int unsigned NOT NULL,
        \`code\` tinyint unsigned NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`startTime\` time NOT NULL,
        \`endTime\` time NOT NULL,
        \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
        \`createdAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),

        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_school_shifts_school_code\`
          (\`schoolId\`, \`code\`),

        CONSTRAINT \`FK_school_shifts_school\`
          FOREIGN KEY (\`schoolId\`)
          REFERENCES \`schools\`(\`id\`)
          ON DELETE RESTRICT
          ON UPDATE NO ACTION,

        CONSTRAINT \`CHK_school_shifts_code\`
          CHECK (\`code\` IN (1, 2)),

        CONSTRAINT \`CHK_school_shifts_time\`
          CHECK (\`startTime\` < \`endTime\`)
      ) ENGINE=InnoDB
    `);

        await queryRunner.query(`
      CREATE TABLE \`school_class_shifts\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`classId\` int unsigned NOT NULL,
        \`shiftId\` int unsigned NOT NULL,
        \`startDate\` date NOT NULL,
        \`endDate\` date NULL,
        \`createdAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),

        PRIMARY KEY (\`id\`),

        UNIQUE KEY \`UQ_class_shifts_start\`
          (\`classId\`, \`startDate\`),

        KEY \`IDX_class_shifts_dates\`
          (\`classId\`, \`startDate\`, \`endDate\`),

        KEY \`IDX_class_shifts_shift\` (\`shiftId\`),

        CONSTRAINT \`FK_class_shifts_class\`
          FOREIGN KEY (\`classId\`)
          REFERENCES \`school_classes\`(\`id\`)
          ON DELETE RESTRICT
          ON UPDATE NO ACTION,

        CONSTRAINT \`FK_class_shifts_shift\`
          FOREIGN KEY (\`shiftId\`)
          REFERENCES \`school_shifts\`(\`id\`)
          ON DELETE RESTRICT
          ON UPDATE NO ACTION,

        CONSTRAINT \`CHK_class_shifts_dates\`
          CHECK (
            \`endDate\` IS NULL
            OR \`endDate\` > \`startDate\`
          )
      ) ENGINE=InnoDB
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP TABLE IF EXISTS `school_class_shifts`',
        );

        await queryRunner.query(
            'DROP TABLE IF EXISTS `school_shifts`',
        );
    }
}
