require('dotenv').config();

const mysql = require('mysql2/promise');
const argon2 = require('argon2');
const { randomBytes } = require('node:crypto');
const readline = require('node:readline/promises');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const LOCK_NAME = 'davomat_bootstrap_super_admin';

async function main() {
  let connection;
  let locked = false;

  try {
    const loginInput = await rl.question('Login [super.admin]: ');

    const login = loginInput.trim().toLowerCase() || 'super.admin';

    const firstName = (await rl.question('Ism: ')).trim();

    const lastName = (await rl.question('Familiya: ')).trim();

    if (!/^[a-z0-9._]{3,50}$/.test(login)) {
      throw new Error('Login formati noto‘g‘ri');
    }

    if (
      firstName.length < 2 ||
      firstName.length > 100 ||
      lastName.length < 2 ||
      lastName.length > 100
    ) {
      throw new Error('Ism va familiyani tekshiring');
    }

    const password = randomBytes(24).toString('base64url');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      charset: 'utf8mb4',
    });

    const [[lockResult]] = await connection.execute(
      'SELECT GET_LOCK(?, 10) AS acquired',
      [LOCK_NAME],
    );

    if (Number(lockResult.acquired) !== 1) {
      throw new Error('Bootstrap blokirovkasi olinmadi');
    }

    locked = true;

    const [[existingAdmin]] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM users
       WHERE role = 'SUPER_ADMIN'`,
    );

    if (Number(existingAdmin.total) > 0) {
      console.log('SUPER_ADMIN mavjud. Yangi akkaunt yaratilmadi.');
      return;
    }

    const [[existingLogin]] = await connection.execute(
      'SELECT COUNT(*) AS total FROM users WHERE login = ?',
      [login],
    );

    if (Number(existingLogin.total) > 0) {
      throw new Error('Ushbu login band');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const [result] = await connection.execute(
      `INSERT INTO users (
        login,
        firstName,
        lastName,
        middleName,
        passwordHash,
        isActive,
        role,
        regionId,
        districtId,
        schoolId
      ) VALUES (
        ?, ?, ?, NULL, ?, 1,
        'SUPER_ADMIN', NULL, NULL, NULL
      )`,
      [login, firstName, lastName, passwordHash],
    );

    console.log('\nSUPER_ADMIN muvaffaqiyatli yaratildi!');
    console.log('ID:', result.insertId);
    console.log('Login:', login);
    console.log('Parol:', password);
    console.log(
      '\nParolni xavfsiz joyga saqlang. ' + 'U qayta ko‘rsatilmaydi.',
    );
  } catch (error) {
    console.error('Xatolik:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    rl.close();

    if (connection) {
      try {
        if (locked) {
          await connection.execute('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
        }
      } finally {
        await connection.end();
      }
    }
  }
}

void main();
