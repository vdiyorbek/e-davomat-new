import { QueryFailedError } from 'typeorm';
import dataSource from './data-source';
import { hashPassword } from '../common/security/password';
import { Person } from '../modules/persons/person.entity';
import { User } from '../modules/users/user.entity';
import { UserRole } from '../modules/users/enums/user-role.enum';

class SetupError extends Error {}

async function main(): Promise<void> {
  const pnfl = process.env.SETUP_ADMIN_PNFL?.trim();
  const login = process.env.SETUP_ADMIN_LOGIN?.trim().toLowerCase();
  const password = process.env.SETUP_ADMIN_PASSWORD;
  const firstName = process.env.SETUP_ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.SETUP_ADMIN_LAST_NAME?.trim();

  delete process.env.SETUP_ADMIN_PNFL;
  delete process.env.SETUP_ADMIN_LOGIN;
  delete process.env.SETUP_ADMIN_PASSWORD;
  delete process.env.SETUP_ADMIN_FIRST_NAME;
  delete process.env.SETUP_ADMIN_LAST_NAME;

  if (!pnfl || !/^[0-9]{14}$/.test(pnfl)) {
    throw new SetupError('PNFL aynan 14 ta raqam bo‘lishi kerak');
  }

  if (!login || !/^[a-z0-9._]{3,50}$/.test(login)) {
    throw new SetupError('Login formati noto‘g‘ri');
  }

  if (!password || password.length < 12 || password.length > 128) {
    throw new SetupError('Parol uzunligi 12–128 belgi bo‘lishi kerak');
  }

  if (!firstName || firstName.length > 100) {
    throw new SetupError('Ism 1–100 belgidan iborat bo‘lishi kerak');
  }

  if (!lastName || lastName.length > 100) {
    throw new SetupError('Familiya 1–100 belgidan iborat bo‘lishi kerak');
  }

  dataSource.setOptions({ logging: false });

  await dataSource.initialize();

  try {
    const passwordHash = await hashPassword(password);

    const result = await dataSource.transaction(async (manager) => {
      const loginOwner = await manager.findOneBy(User, { login });

      if (loginOwner) {
        throw new SetupError('Bu login band');
      }

      let person = await manager.findOne(Person, {
        where: { pnfl },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });

      if (person?.deletedAt) {
        throw new SetupError(
          'Bu shaxs arxivlangan. Avval uning holatini tekshiring',
        );
      }

      if (person) {
        const existingUser = await manager.findOneBy(User, {
          personId: person.id,
        });

        if (existingUser) {
          throw new SetupError(
            'Bu shaxsning hisobi mavjud. Uning roli avtomatik o‘zgartirilmadi',
          );
        }
      } else {
        person = manager.create(Person, {
          pnfl,
          firstName,
          lastName,
        });

        person = await manager.save(person);
      }

      const user = manager.create(User, {
        personId: person.id,
        login,
        passwordHash,
        isActive: true,
        role: UserRole.SUPER_ADMIN,
        regionId: null,
        districtId: null,
        schoolId: null,
      });

      const saved = await manager.save(user);

      return {
        userId: saved.id,
        personId: person.id,
        login: saved.login,
        role: saved.role,
      };
    });

    console.log('Bosh administrator yaratildi:');
    console.log(result);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof SetupError) {
    console.error(error.message);
  } else if (error instanceof QueryFailedError) {
    const driverError = error.driverError as { code?: string };

    if (driverError.code === 'ER_DUP_ENTRY') {
      console.error('Login, PNFL yoki shaxsga bog‘langan hisob takrorlandi');
    } else {
      console.error('Baza xatosi:', driverError.code ?? 'Noma’lum SQL xatosi');
    }
  } else {
    console.error(
      'Administrator yaratilmadi. Baza ulanishi va sozlamalarni tekshiring',
    );
  }

  process.exitCode = 1;
});
