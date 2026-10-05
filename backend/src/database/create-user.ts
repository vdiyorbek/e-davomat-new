import { QueryFailedError } from 'typeorm';
import dataSource from './data-source';
import { Person } from 'src/modules/persons/person.entity';
import { User } from 'src/modules/users/user.entity';
import { hashPassword } from 'src/common/security/password';

class SetupError extends Error {}

async function main(): Promise<void> {
  const pnfl = process.env.SETUP_USER_PNFL?.trim();
  const login = process.env.SETUP_USER_LOGIN?.trim().toLowerCase();
  const password = process.env.SETUP_USER_PASSWORD;
  delete process.env.SETUP_USER_PNFL;
  delete process.env.SETUP_USER_LOGIN;
  delete process.env.SETUP_USER_PASSWORD;
  if (!pnfl || !/^[0-9]{14}$/.test(pnfl)) {
    throw new SetupError('PNFL aynan 14 ta raqam bo‘lishi kerak');
  }

  if (!login || !/^[a-z0-9._]{3,50}$/.test(login)) {
    throw new SetupError(
      'Login 3–50 belgili bo‘lsin: lotin harflari, raqam, nuqta yoki pastki chiziq',
    );
  }

  if (!password || password.length < 12 || password.length > 128) {
    throw new SetupError('Parol uzunligi 12–128 belgi bo‘lishi kerak');
  }

  dataSource.setOptions({ logging: false });

  await dataSource.initialize();

  try {
    const passwordHash = await hashPassword(password);

    const result = await dataSource.transaction(async (manager) => {
      const person = await manager.findOne(Person, {
        where: { pnfl },
        lock: { mode: 'pessimistic_write' },
      });

      if (!person) {
        throw new SetupError('Shaxs topilmadi yoki arxivlangan');
      }

      const existingUser = await manager.findOneBy(User, {
        personId: person.id,
      });

      if (existingUser) {
        throw new SetupError('Bu shaxsning kabinet hisobi allaqachon mavjud');
      }

      const loginOwner = await manager.findOneBy(User, {
        login,
      });

      if (loginOwner) {
        throw new SetupError('Bu login band. Boshqa login tanlang');
      }

      const user = manager.create(User, {
        personId: person.id,
        login,
        passwordHash,
        isActive: true,
      });

      const saved = await manager.save(user);

      return {
        userId: saved.id,
        personId: person.id,
        login: saved.login,
        firstName: person.firstName,
        lastName: person.lastName,
      };
    });

    console.log('Kabinet hisobi yaratildi:');
    console.log(result);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof SetupError) {
    console.error(error.message);
  } else if (error instanceof QueryFailedError) {
    const driverError = error.driverError as {
      code?: string;
    };

    if (driverError.code === 'ER_DUP_ENTRY') {
      console.error(
        'Login band yoki bu shaxsning kabinet hisobi allaqachon mavjud',
      );
    } else {
      console.error('Baza xatosi:', driverError.code ?? 'Noma’lum SQL xatosi');
    }
  } else {
    console.error(
      'Hisob yaratilmadi. Baza ulanishi va sozlamalarni tekshiring',
    );
  }

  process.exitCode = 1;
});
