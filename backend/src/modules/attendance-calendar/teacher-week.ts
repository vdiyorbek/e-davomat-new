import type { DataSource, EntityManager } from 'typeorm';

import { tashkentDate } from '../hikvision-push/hikvision-push.types';

/**
 * O‘qituvchining «faqat boshlang‘ich sinflarda dars beradi» belgisini qayta hisoblaydi:
 * hozirgi faol biriktirishlari bor va hammasi 1..maxGrade sinflarda bo‘lsa — 1.
 * Biriktirishi yo‘q o‘qituvchi umumiy haftada (0) qoladi.
 */
export async function refreshPrimaryOnly(
  db: DataSource | EntityManager,
  maxGrade: number,
  membershipIds?: number[],
): Promise<void> {
  if (membershipIds && membershipIds.length === 0) return;

  const today = tashkentDate(new Date());
  const filter = membershipIds
    ? ` AND m.id IN (${membershipIds.map(() => '?').join(',')})`
    : '';
  const active = 't.startDate <= ? AND (t.endDate IS NULL OR t.endDate > ?)';

  await db.query(
    `UPDATE school_memberships m
        SET m.primaryOnly = IF(
              EXISTS (
                SELECT 1 FROM teacher_class_subjects t
                  JOIN school_classes c ON c.id = t.classId
                 WHERE t.teacherMembershipId = m.id AND ${active}
              )
              AND NOT EXISTS (
                SELECT 1 FROM teacher_class_subjects t
                  JOIN school_classes c ON c.id = t.classId
                 WHERE t.teacherMembershipId = m.id AND ${active}
                   AND (c.gradeLevel IS NULL OR c.gradeLevel > ?)
              ), 1, 0)
      WHERE m.type = 'TEACHER'${filter}`,
    [today, today, today, today, maxGrade, ...(membershipIds ?? [])],
  );
}
