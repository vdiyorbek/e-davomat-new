import { MigrationInterface } from "typeorm";

// Bu migratsiya 1792694243577-AddTeacherStudentRoles bilan bir xil edi.
// Ba'zi bazalarda allaqachon bajarilgan bo'lishi mumkinligi uchun fayl
// o'chirilmadi, faqat bo'sh qilindi: aks holda bitta qadam rollback
// TEACHER va STUDENT rollarini enum'dan olib tashlab yuborardi.
export class AddTeacherStudentRoles1792694671445 implements MigrationInterface {
    name = 'AddTeacherStudentRoles1792694671445'

    public async up(): Promise<void> {}

    public async down(): Promise<void> {}

}
