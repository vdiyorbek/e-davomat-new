import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherPrimaryOnly1795500000000 implements MigrationInterface {
  name = 'AddTeacherPrimaryOnly1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // O‘qituvchi faqat boshlang‘ich (1–4) sinflarda dars beradimi — standart
    // o‘quv haftasi (5 yoki 6 kun) shunga qarab tanlanadi. Qiymatni
    // biriktirishlar o‘zgarganda va har kecha ilova yangilaydi.
    await queryRunner.query(`
      ALTER TABLE \`school_memberships\`
        ADD COLUMN \`primaryOnly\` tinyint(1) NOT NULL DEFAULT 0
    `);

    // Boshlang‘ich qiymat: hozirgi faol biriktirishlar bo‘yicha (1–4 sinf).
    await queryRunner.query(`
      UPDATE \`school_memberships\` m
         SET m.\`primaryOnly\` = IF(
               EXISTS (
                 SELECT 1 FROM \`teacher_class_subjects\` t
                   JOIN \`school_classes\` c ON c.\`id\` = t.\`classId\`
                  WHERE t.\`teacherMembershipId\` = m.\`id\`
                    AND t.\`startDate\` <= CURDATE()
                    AND (t.\`endDate\` IS NULL OR t.\`endDate\` > CURDATE())
               )
               AND NOT EXISTS (
                 SELECT 1 FROM \`teacher_class_subjects\` t
                   JOIN \`school_classes\` c ON c.\`id\` = t.\`classId\`
                  WHERE t.\`teacherMembershipId\` = m.\`id\`
                    AND t.\`startDate\` <= CURDATE()
                    AND (t.\`endDate\` IS NULL OR t.\`endDate\` > CURDATE())
                    AND (c.\`gradeLevel\` IS NULL OR c.\`gradeLevel\` > 4)
               ), 1, 0)
       WHERE m.\`type\` = 'TEACHER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `school_memberships` DROP COLUMN `primaryOnly`',
    );
  }
}
