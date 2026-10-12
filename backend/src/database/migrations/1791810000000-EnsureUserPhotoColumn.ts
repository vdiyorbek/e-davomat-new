import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class EnsureUserPhotoColumn1791810000000 implements MigrationInterface {
  name = 'EnsureUserPhotoColumn1791810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasColumn('users', 'photoUrl');

    if (!exists) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'photoUrl',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ma'lumot saqlangan rasm manzillarini
    // tasodifan o'chirmaslik uchun avtomatik
    // rollbackda ustunni olib tashlamaymiz.
  }
}
