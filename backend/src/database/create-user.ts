import { QueryFailedError } from 'typeorm';
import dataSource from './data-source';
import { User } from '../modules/users/user.entity';
import { UserRole } from '../modules/users/enums/user-role.enum';
import { hashPassword } from '../common/security/password';

class SetupError extends Error {}

async function main(): Promise<void> {
  const firstName = process.env.SETUP_USER_FIRST_NAME?.trim();
  const lastName = process.env.SETUP_USER_LAST_NAME?.trim();
  const middleName = process.env.SETUP_USER_MIDDLE_NAME?.trim() || null;

  const login = process.env.SETUP_USER_LOGIN?.trim().toLowerCase();

  const password = process.env.SETUP_USER_PASSWORD;

  delete process.env.SETUP_USER_FIRST_NAME;
  delete process.env.SETUP_USER_LAST_NAME;
  delete process.env.SETUP_USER_MIDDLE_NAME;
  delete process.env.SETUP_USER_LOGIN;
  delete process.env.SETUP_USER_PASSWORD;

  if (!firstName || firstName.length > 100) {
    throw new SetupError('Ism 1–100 belgidan iborat bo‘lishi kerak');
  }

  if (!lastName || lastName.length > 100) {
    throw new SetupError('Familiya 1–100 belgidan iborat bo‘lishi kerak');
  }

  if (middleName && middleName.length > 100) {
    throw new SetupError('Otasining ismi 100 belgidan oshmasligi kerak');
  }

  if (!login || !/^[a-z0-9._]{3,50}$/.test(login)) {
    throw new SetupError('Login formati noto‘g‘ri');
  }

  if (!password || password.length < 12 || password.length > 128) {
    throw new SetupError('Parol 12–128 belgidan iborat bo‘lishi kerak');
  }

  dataSource.setOptions({ logging: false });
  await dataSource.initialize();

  try {
    const passwordHash = await hashPassword(password);

    const result = await dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(User, {
        login,
      });

      if (existing) {
        throw new SetupError('Ushbu login band');
      }

      const user = manager.create(User, {
        firstName,
        lastName,
        middleName,
        login,
        passwordHash,
        role: UserRole.USER,
        isActive: true,
        regionId: null,
        districtId: null,
        schoolId: null,
      });

      const saved = await manager.save(User, user);

      return {
        id: saved.id,
        login: saved.login,
        firstName: saved.firstName,
        lastName: saved.lastName,
        role: saved.role,
      };
    });

    console.log('Foydalanuvchi yaratildi:', result);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof SetupError) {
    console.error(error.message);
  } else if (error instanceof QueryFailedError) {
    console.error('Ma’lumotlar bazasi xatosi. Login band bo‘lishi mumkin.');
  } else {
    console.error('Foydalanuvchini yaratishda xatolik.');
  }

  process.exitCode = 1;
});
