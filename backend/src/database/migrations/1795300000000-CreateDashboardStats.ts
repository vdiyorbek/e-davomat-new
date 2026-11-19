import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDashboardStats1795300000000 implements MigrationInterface {
  name = 'CreateDashboardStats1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kechikish chegarasini maktab o‘zi belgilaydi; yuqori adminlar kim va
    // qachon o‘zgartirganini ko‘radi.
    await queryRunner.query(`
      ALTER TABLE \`schools\`
        ADD COLUMN \`lateThresholdMinutes\` smallint unsigned NOT NULL DEFAULT 5,
        ADD COLUMN \`lateThresholdUpdatedAt\` datetime(3) NULL,
        ADD COLUMN \`lateThresholdUpdatedByUserId\` int unsigned NULL
    `);

    // Xaritadagi hudud kodi (avtomatik moslanmagan nomlar uchun qo‘lda).
    await queryRunner.query(`
      ALTER TABLE \`regions\`
        ADD COLUMN \`geoKey\` varchar(20) NULL,
        ADD UNIQUE KEY \`UQ_regions_geo_key\` (\`geoKey\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`districts\`
        ADD COLUMN \`geoKey\` varchar(80) NULL,
        ADD UNIQUE KEY \`UQ_districts_geo_key\` (\`geoKey\`)
    `);

    // Maktab × kun × tur bo‘yicha tayyor ko‘rsatkichlar (dashboard faqat shundan o‘qiydi).
    await queryRunner.query(`
      CREATE TABLE \`school_daily_stats\` (
        \`schoolId\` int unsigned NOT NULL,
        \`date\` date NOT NULL,
        \`membershipType\` enum('STUDENT','TEACHER') NOT NULL,
        \`districtId\` int unsigned NOT NULL,
        \`regionId\` int unsigned NOT NULL,
        \`members\` int unsigned NOT NULL DEFAULT 0,
        \`expected\` int unsigned NOT NULL DEFAULT 0,
        \`present\` int unsigned NOT NULL DEFAULT 0,
        \`excused\` int unsigned NOT NULL DEFAULT 0,
        \`absent\` int unsigned NOT NULL DEFAULT 0,
        \`late\` int unsigned NOT NULL DEFAULT 0,
        \`lateEvaluated\` int unsigned NOT NULL DEFAULT 0,
        \`inside\` int unsigned NOT NULL DEFAULT 0,
        \`dayOff\` int unsigned NOT NULL DEFAULT 0,
        \`unknown\` int unsigned NOT NULL DEFAULT 0,
        \`assumedWorkDay\` int unsigned NOT NULL DEFAULT 0,
        \`noData\` int unsigned NOT NULL DEFAULT 0,
        \`shift1Expected\` int unsigned NOT NULL DEFAULT 0,
        \`shift1Present\` int unsigned NOT NULL DEFAULT 0,
        \`shift1Excused\` int unsigned NOT NULL DEFAULT 0,
        \`shift1Late\` int unsigned NOT NULL DEFAULT 0,
        \`shift2Expected\` int unsigned NOT NULL DEFAULT 0,
        \`shift2Present\` int unsigned NOT NULL DEFAULT 0,
        \`shift2Excused\` int unsigned NOT NULL DEFAULT 0,
        \`shift2Late\` int unsigned NOT NULL DEFAULT 0,
        \`hasData\` tinyint(1) NOT NULL DEFAULT 0,
        \`computedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`schoolId\`, \`date\`, \`membershipType\`),
        KEY \`IDX_sds_date_region\` (\`date\`, \`regionId\`),
        KEY \`IDX_sds_date_district\` (\`date\`, \`districtId\`)
      ) ENGINE=InnoDB
    `);

    // Sinf × kun: o‘quv kuni holati (5/6 kunlik hafta, bayramlar) va sonlar.
    await queryRunner.query(`
      CREATE TABLE \`class_day_states\` (
        \`classId\` int unsigned NOT NULL,
        \`date\` date NOT NULL,
        \`schoolId\` int unsigned NOT NULL,
        \`state\` enum('WORK_DAY','DAY_OFF','UNKNOWN') NOT NULL,
        \`hasData\` tinyint(1) NOT NULL DEFAULT 0,
        \`expected\` int unsigned NOT NULL DEFAULT 0,
        \`present\` int unsigned NOT NULL DEFAULT 0,
        \`excused\` int unsigned NOT NULL DEFAULT 0,
        \`absent\` int unsigned NOT NULL DEFAULT 0,
        \`late\` int unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY (\`classId\`, \`date\`),
        KEY \`IDX_cds_school_date\` (\`schoolId\`, \`date\`)
      ) ENGINE=InnoDB
    `);

    // Ketma-ket 5 o‘quv kuni sababsiz kelmaganlar (kun bo‘yicha surat).
    await queryRunner.query(`
      CREATE TABLE \`absence_streaks\` (
        \`schoolId\` int unsigned NOT NULL,
        \`date\` date NOT NULL,
        \`personId\` int unsigned NOT NULL,
        \`classId\` int unsigned NOT NULL,
        \`days\` smallint unsigned NOT NULL,
        \`sinceDate\` date NOT NULL,
        PRIMARY KEY (\`schoolId\`, \`date\`, \`personId\`),
        KEY \`IDX_absence_streaks_date\` (\`date\`, \`schoolId\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `absence_streaks`');
    await queryRunner.query('DROP TABLE IF EXISTS `class_day_states`');
    await queryRunner.query('DROP TABLE IF EXISTS `school_daily_stats`');
    await queryRunner.query(
      'ALTER TABLE `districts` DROP INDEX `UQ_districts_geo_key`, DROP COLUMN `geoKey`',
    );
    await queryRunner.query(
      'ALTER TABLE `regions` DROP INDEX `UQ_regions_geo_key`, DROP COLUMN `geoKey`',
    );
    await queryRunner.query(`
      ALTER TABLE \`schools\`
        DROP COLUMN \`lateThresholdUpdatedByUserId\`,
        DROP COLUMN \`lateThresholdUpdatedAt\`,
        DROP COLUMN \`lateThresholdMinutes\`
    `);
  }
}
