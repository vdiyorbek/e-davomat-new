#!/usr/bin/env node
'use strict';

/**
 * Eski E-davomat bazasidan (davomat-new) yangi tizimga ko‘chirish — A bosqichi:
 *   viloyat → tuman → mahalla → maktab → sinf → o‘quvchi va o‘qituvchi (shaxs + a’zolik) → ota-ona telefonlari.
 *
 * Ishlatish (backend papkasidan; `.env` shu yerdan o‘qiladi):
 *
 *   OLD_DB_USER=... OLD_DB_PASSWORD=... node scripts/import-legacy.cjs            # QURUQ rejim: faqat hisobot, hech narsa yozilmaydi
 *   OLD_DB_USER=... OLD_DB_PASSWORD=... node scripts/import-legacy.cjs --apply --confirm-backup
 *
 * Xavfsizlik:
 *  • Eski bazadan faqat SELECT; parol, token va rasm ustunlari umuman o‘qilmaydi.
 *  • Hisobot va muammolar ro‘yxati shaxsiy ma’lumotsiz: faqat eski ID va muammo kodi.
 *  • Takror ishga tushirish xavfsiz: mavjud yozuvlar o‘zgartirilmaydi, faqat yetishmaydiganlari qo‘shiladi.
 *  • `--apply` bitta tranzaksiyada bajariladi: xato bo‘lsa hech narsa yozilmaydi.
 *
 * Sozlamalar (ixtiyoriy):
 *   --start-date=2026-09-01      a’zolik boshlanish sanasi (standart: joriy o‘quv yilining 1-sentyabri)
 *   --academic-year=2026-2027    sinflar o‘quv yili (standart: bugungi sanadan)
 *   --teacher-class-homeroom     o‘qituvchining eski `classId` sini «sinf rahbari» deb olish (standart: o‘chiq)
 *   --guardian-min-name=3        ota/ona ismining eng qisqa uzunligi
 *   Ota/ona yozuvi faqat telefoni yaroqli bo‘lsa yaratiladi (ism yaroqsiz bo‘lsa — ismsiz, faqat telefon bilan).
 *   --require-guardian-name      qat’iyroq: ism ham yaroqli bo‘lishi shart (ismsiz telefonli yozuvlar tashlanadi)
 *   --keep-name-only-guardians   telefoni yaroqsiz/bo‘sh bo‘lsa ham, ismi yaroqli ota/onani saqlash (tavsiya etilmaydi)
 *   --report-dir=./import-reports
 *   OLD_DB_HOST, OLD_DB_PORT, OLD_DB_NAME (standart: 127.0.0.1, 3306, davomat-new)
 */

const fs = require('node:fs');
const path = require('node:path');
// `.env`: avval joriy papkadan, topilmasa skript yonidagi backend papkasidan.
for (const dir of [process.cwd(), path.resolve(__dirname, '..')]) {
  const envFile = path.join(dir, '.env');
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile, quiet: true });
    break;
  }
}
const mysql = require('mysql2/promise');

// ───────────────────────── sozlamalar ─────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? true] : [arg, true];
  }),
);
const APPLY = args.apply === true;
const CONFIRMED = args['confirm-backup'] === true;
const TEACHER_CLASS_HOMEROOM = args['teacher-class-homeroom'] === true;
// Ota/ona yozuvi FAQAT telefoni yaroqli bo‘lsa yaratiladi. Ism yaroqsiz bo‘lsa («0», «-», bo‘sh, qisqa) — ism yozilmaydi, yozuv faqat telefon bilan saqlanadi.
const GUARDIAN_MIN_NAME = Number(typeof args['guardian-min-name'] === 'string' ? args['guardian-min-name'] : 3);
const KEEP_PHONE_ONLY = args['require-guardian-name'] !== true; // ismi yaroqsiz, telefoni yaroqli → ismsiz saqlanadi (standart)
const KEEP_NAME_ONLY = args['keep-name-only-guardians'] === true; // ismi yaroqli, telefoni yaroqsiz/bo‘sh
const CHUNK = 1000;

function tashkentToday() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function academicYearFor(iso) {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
const TODAY = tashkentToday();
const ACADEMIC_YEAR =
  typeof args['academic-year'] === 'string' ? args['academic-year'] : academicYearFor(TODAY);
const START_DATE =
  typeof args['start-date'] === 'string'
    ? args['start-date']
    : `${ACADEMIC_YEAR.slice(0, 4)}-09-01`;
const REPORT_DIR = path.resolve(
  typeof args['report-dir'] === 'string' ? args['report-dir'] : './import-reports',
);

if (!/^\d{4}-\d{4}$/.test(ACADEMIC_YEAR)) fail('--academic-year 2026-2027 ko‘rinishida bo‘lishi kerak');
if (!/^\d{4}-\d{2}-\d{2}$/.test(START_DATE)) fail('--start-date YYYY-MM-DD ko‘rinishida bo‘lishi kerak');
if (APPLY && !CONFIRMED) {
  fail('Yozishdan oldin zaxira oling va `--confirm-backup` bayrog‘ini qo‘shing: --apply --confirm-backup');
}

function fail(message) {
  console.error(`XATO: ${message}`);
  process.exit(1);
}

// ───────────────────────── tozalash funksiyalari ─────────────────────────

const clean = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());
const digits = (value) => clean(value).replace(/\D/g, '');

/** JShShIR: aniq 14 raqam. */
function normPnfl(value) {
  const d = digits(value);
  return d.length === 14 ? d : null;
}

/** Telefon: +998XXXXXXXXX. Bir nechta raqam yozilgan bo‘lsa, birinchi yaroqlisi olinadi. */
function normPhone(value) {
  for (const part of clean(value).split(/[,;/]/)) {
    let d = digits(part);
    if (d.length === 10 && d.startsWith('8')) d = `998${d.slice(1)}`;
    if (d.length === 9) d = `998${d}`;
    if (d.length === 12 && d.startsWith('998')) return `+${d}`;
  }
  return null;
}

const MALE = /^(erkak|e|m|male|м|муж|мужской|мужчина|1|o'g'il|ogil|ўғил)$/i;
const FEMALE = /^(ayol|a|f|female|ж|жен|женский|женщина|2|qiz|қиз|q)$/i;
function normGender(value) {
  const g = clean(value).replace(/\.$/, '');
  if (!g) return null;
  if (MALE.test(g)) return 'MALE';
  if (FEMALE.test(g)) return 'FEMALE';
  return undefined; // tanib bo‘lmadi
}

function normBirth(value) {
  const s = clean(value);
  if (!s) return null;
  let y, m, d;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) [, y, m, d] = match;
  else if ((match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s))) [, d, m, y] = match;
  else return undefined;
  const year = Number(y), month = Number(m), day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  const ok =
    year >= 1900 &&
    year <= new Date().getUTCFullYear() &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return ok ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : undefined;
}

/** Millat: imlo variantlarini bitta shaklga keltiradi («O'ZBEK», «o'zbrk», «Ozbek» → «O‘zbek»). */
const APOS = /[’ʻʼ`‘']/g;
const NATION_GROUPS = [
  { name: 'O‘zbek', exact: ['ozbek', 'uzbek', 'узбек', 'ўзбек', 'o zbek', 'ozbejk'], near: ['ozbek', 'uzbek'] },
  { name: 'Tojik', exact: ['tojik', 'tajik', 'tadjik', 'tadzhik', 'таджик', 'тожик', 'тоҷик'], near: ['tojik'] },
  { name: 'Turkman', exact: ['turkman', 'turkmen', 'tukmen', 'turman', 'tukman', 'turkmon', 'туркмен'], near: ['turkman', 'turkmen'] },
  { name: 'Afg‘on', exact: ['afgon', 'afgan', 'avgon', 'avgan', 'afganes', 'avganes', 'afgonistonlik'], near: ['afgon', 'afgan', 'avgon'] },
  { name: 'Rus', exact: ['rus', 'russ', 'russkiy', 'русский', 'рус'], near: [] },
  { name: 'Tatar', exact: ['tatar', 'tatarin', 'татар'], near: [] },
  { name: 'Lo‘li', exact: ['loli', 'luli', 'lyuli'], near: [] },
  { name: 'Azarbayjon', exact: ['azarbayjon', 'azarbayjan', 'azerbayjon', 'azerbaijan', 'ozarbayjon'], near: [] },
  { name: 'Qoraqalpoq', exact: ['qoraqalpoq', 'karakalpak', 'qoraqalpok', 'каракалпак'], near: [] },
];
const NATION_BLANK = new Set(['erkak', 'ayol', '-', '0', '1', 'yoq', 'nomalum']); // millat o‘rniga adashib yozilganlar

function editDistanceAtMost1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function normNational(value) {
  const raw = clean(value);
  if (!raw) return null;
  const key = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(APOS, '').replace(/\s+/g, ' ');
  if (NATION_BLANK.has(key)) return null;
  for (const group of NATION_GROUPS) {
    if (group.exact.includes(key)) return group.name;
  }
  // Kichik imlo xatolari (bitta harf farqi): faqat o‘zbek, tojik, turkman, afg‘on oilalari uchun.
  if (key.length >= 4) {
    for (const group of NATION_GROUPS) {
      if (group.near.some((n) => editDistanceAtMost1(key, n))) return group.name;
    }
  }
  return raw
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(APOS, '‘')
    .slice(0, 100);
}

/** Sinf nomi: bo‘shliq va chiziqsiz, katta harf: «5-a» → «5A». */
function normClassName(value) {
  return clean(value).replace(/[\s-]+/g, '').toUpperCase().slice(0, 30);
}
function gradeOf(name) {
  const match = /^(\d{1,2})/.exec(name);
  const n = match ? Number(match[1]) : NaN;
  return n >= 1 && n <= 11 ? n : null;
}

const PLACEHOLDER_NAME = /^(yo[‘'`ʻ’]?q|nomalum|no[‘'`ʻ’]malum|mavjud emas|нет|йўқ|йук)$/i;
/** Ism yaroqsiz bo‘lsa sababini, yaroqli bo‘lsa null qaytaradi. */
function guardianNameProblem(value) {
  const t = clean(value);
  if (!t) return 'ism bo‘sh';
  if (!/\p{L}/u.test(t)) return 'ismda harf yo‘q';
  if (t.length < GUARDIAN_MIN_NAME) return 'ism juda qisqa';
  if (PLACEHOLDER_NAME.test(t)) return 'ism o‘rnida «yo‘q» kabi belgi';
  return null;
}

/** Ota/ona F.I.Sh. → familiya, ism, otasining ismi. */
function splitName(value) {
  const parts = clean(value).split(' ').filter(Boolean);
  const cut = (s) => (s ? s.slice(0, 100) : null);
  if (parts.length === 0) return { lastName: null, firstName: null, middleName: null };
  if (parts.length === 1) return { lastName: null, firstName: cut(parts[0]), middleName: null };
  if (parts.length === 2) return { lastName: cut(parts[0]), firstName: cut(parts[1]), middleName: null };
  return { lastName: cut(parts[0]), firstName: cut(parts[1]), middleName: cut(parts.slice(2).join(' ')) };
}

const pattern = (value) => clean(value).replace(/\d/g, '9').slice(0, 24) || '(bo‘sh)';

function tally(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}
function top(map, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ───────────────────────── hisobot ─────────────────────────

const report = {
  mode: APPLY ? 'APPLY' : 'DRY-RUN',
  startedAt: new Date().toISOString(),
  params: { academicYear: ACADEMIC_YEAR, startDate: START_DATE, teacherClassHomeroom: TEACHER_CLASS_HOMEROOM },
  geo: {},
  people: {},
  distributions: {},
};
const problems = []; // [entity, legacyId, code]
const problemCounts = new Map();
function problem(entity, legacyId, code) {
  problems.push([entity, legacyId, code]);
  tally(problemCounts, `${entity}:${code}`);
}

// ───────────────────────── asosiy ish ─────────────────────────

async function main() {
  if (!process.env.OLD_DB_USER) fail('OLD_DB_USER va OLD_DB_PASSWORD berilishi kerak');
  for (const name of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (!process.env[name]) fail(`${name} topilmadi: yangi baza sozlamalari backend/.env da bo‘lishi kerak. Skriptni backend papkasidan ishga tushiring (cd .../backend && node scripts/import-legacy.cjs).`);
  }
  const oldDb = await mysql.createPool({
    host: process.env.OLD_DB_HOST || '127.0.0.1',
    port: Number(process.env.OLD_DB_PORT || 3306),
    user: process.env.OLD_DB_USER,
    password: process.env.OLD_DB_PASSWORD,
    database: process.env.OLD_DB_NAME || 'davomat-new',
    charset: 'utf8mb4',
    dateStrings: true,
    connectionLimit: 2,
  });
  const newDb = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    charset: 'utf8mb4',
    dateStrings: true,
    connectionLimit: 2,
  });

  console.log(`Rejim: ${report.mode}`);
  console.log(`Eski baza : ${process.env.OLD_DB_NAME || 'davomat-new'} (faqat o‘qiladi)`);
  console.log(`Yangi baza: ${process.env.DB_DATABASE}@${process.env.DB_HOST}`);
  console.log(`O‘quv yili: ${ACADEMIC_YEAR}, a’zolik boshlanishi: ${START_DATE}\n`);

  const conn = await newDb.getConnection();
  try {
    if (APPLY) await conn.beginTransaction();
    const ctx = { oldDb, db: conn, fake: 0 };
    const geo = await phaseGeo(ctx);
    await phasePeople(ctx, geo);
    if (APPLY) await conn.commit();
  } catch (error) {
    if (APPLY) await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
    await oldDb.end();
    await newDb.end();
  }

  finish();
}

/** Ma’lumotnoma: dry-run da yaratiladigan yozuvlar uchun soxta (manfiy) ID. */
function fakeId(ctx) {
  ctx.fake -= 1;
  return ctx.fake;
}

/**
 * Ko‘p qatorli INSERT: MySQL haqiqatan nechta qator yozganini kutilgan son bilan solishtiradi.
 * Mos kelmasa yoki ogohlantirish bo‘lsa — sababini chiqarib, xato beradi (tranzaksiya qaytariladi).
 */
async function insertChecked(db, label, sql, rows) {
  const [res] = await db.query(sql, [rows]);
  if (res.warningStatus > 0) {
    const [warnings] = await db.query('SHOW WARNINGS');
    const kinds = new Map();
    for (const w of warnings) tally(kinds, `${w.Level} ${w.Code}: ${String(w.Message).replace(/\d+/g, 'N')}`);
    console.error(`  ${label}: MySQL ogohlantirishlari: ${JSON.stringify(top(kinds, 5))}`);
  }
  if (res.affectedRows !== rows.length) {
    throw new Error(`${label}: ${rows.length} ta qator yuborildi, lekin MySQL ${res.affectedRows} tasini yozdi. Hech narsa saqlanmadi.`);
  }
  return res;
}

async function select(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

// ───── geografiya: viloyat, tuman, mahalla, maktab, sinf ─────

async function phaseGeo(ctx) {
  const { oldDb, db } = ctx;
  const maps = { region: new Map(), district: new Map(), mahalla: new Map(), school: new Map(), klass: new Map(), klassSchool: new Map() };
  const stat = (name) => (report.geo[name] = { eski: 0, yangi: 0, mavjud: 0, tashlandi: 0 });

  // Viloyatlar
  const s1 = stat('viloyat');
  const existing = new Map((await select(db, 'SELECT id, name FROM regions')).map((r) => [r.name, r.id]));
  for (const row of await select(oldDb, 'SELECT id, name_uz FROM Regions ORDER BY id')) {
    s1.eski++;
    const name = clean(row.name_uz).slice(0, 150);
    if (!name) { problem('Regions', row.id, 'NO_NAME'); s1.tashlandi++; continue; }
    let id = existing.get(name);
    if (id) s1.mavjud++;
    else {
      id = APPLY ? (await db.query('INSERT INTO regions (name) VALUES (?)', [name]))[0].insertId : fakeId(ctx);
      existing.set(name, id);
      s1.yangi++;
    }
    maps.region.set(row.id, id);
  }

  // Tumanlar
  const s2 = stat('tuman');
  const districts = new Map((await select(db, 'SELECT id, regionId, name FROM districts')).map((r) => [`${r.regionId}|${r.name}`, r.id]));
  for (const row of await select(oldDb, 'SELECT id, regionId, name_uz FROM Districts ORDER BY id')) {
    s2.eski++;
    const name = clean(row.name_uz).slice(0, 150);
    const regionId = maps.region.get(row.regionId);
    if (!name || !regionId) { problem('Districts', row.id, !name ? 'NO_NAME' : 'NO_REGION'); s2.tashlandi++; continue; }
    const key = `${regionId}|${name}`;
    let id = districts.get(key);
    if (id) s2.mavjud++;
    else {
      id = APPLY ? (await db.query('INSERT INTO districts (name, regionId) VALUES (?, ?)', [name, regionId]))[0].insertId : fakeId(ctx);
      districts.set(key, id);
      s2.yangi++;
    }
    maps.district.set(row.id, id);
  }

  // Mahallalar
  const s3 = stat('mahalla');
  const mahallas = new Map((await select(db, 'SELECT id, districtId, name FROM mahallas')).map((r) => [`${r.districtId}|${r.name}`, r.id]));
  for (const row of await select(oldDb, 'SELECT id, districtId, name_uz FROM Mahallas ORDER BY id')) {
    s3.eski++;
    const name = clean(row.name_uz).slice(0, 150);
    const districtId = maps.district.get(row.districtId);
    if (!name || !districtId) { problem('Mahallas', row.id, !name ? 'NO_NAME' : 'NO_DISTRICT'); s3.tashlandi++; continue; }
    const key = `${districtId}|${name}`;
    let id = mahallas.get(key);
    if (id) s3.mavjud++;
    else {
      id = APPLY ? (await db.query('INSERT INTO mahallas (districtId, name) VALUES (?, ?)', [districtId, name]))[0].insertId : fakeId(ctx);
      mahallas.set(key, id);
      s3.yangi++;
    }
    maps.mahalla.set(row.id, id);
  }

  // Maktablar
  const s4 = stat('maktab');
  const schools = new Map((await select(db, 'SELECT id, districtId, name FROM schools')).map((r) => [`${r.districtId}|${r.name}`, r.id]));
  const coord = (v, lim) => (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= lim && Number(v) !== 0 ? Number(v) : null);
  for (const row of await select(oldDb, 'SELECT id, districtId, name_uz, latitude, longitude FROM Schools ORDER BY id')) {
    s4.eski++;
    const name = clean(row.name_uz).slice(0, 200);
    const districtId = maps.district.get(row.districtId);
    if (!name || !districtId) { problem('Schools', row.id, !name ? 'NO_NAME' : 'NO_DISTRICT'); s4.tashlandi++; continue; }
    const key = `${districtId}|${name}`;
    let id = schools.get(key);
    if (id) s4.mavjud++;
    else {
      id = APPLY
        ? (await db.query('INSERT INTO schools (name, districtId, latitude, longitude) VALUES (?, ?, ?, ?)', [name, districtId, coord(row.latitude, 90), coord(row.longitude, 180)]))[0].insertId
        : fakeId(ctx);
      schools.set(key, id);
      s4.yangi++;
    }
    maps.school.set(row.id, id);
  }

  // Sinflar
  const s5 = stat('sinf');
  const classes = new Map((await select(db, 'SELECT id, schoolId, name FROM school_classes WHERE academicYear = ?', [ACADEMIC_YEAR])).map((r) => [`${r.schoolId}|${r.name}`, r.id]));
  const nameChanges = new Map();
  for (const row of await select(oldDb, 'SELECT id, schoolId, name_uz FROM Klas ORDER BY id')) {
    s5.eski++;
    const name = normClassName(row.name_uz);
    const schoolId = maps.school.get(row.schoolId);
    if (!name || !schoolId) { problem('Klas', row.id, !name ? 'NO_NAME' : 'NO_SCHOOL'); s5.tashlandi++; continue; }
    if (name !== clean(row.name_uz)) tally(nameChanges, 'nom tozalandi (masalan 5-a → 5A)');
    const key = `${schoolId}|${name}`;
    let id = classes.get(key);
    if (id) {
      s5.mavjud++;
      if (maps.klass.size && [...maps.klass.values()].includes(id)) problem('Klas', row.id, 'DUP_NAME_AFTER_CLEANING');
    } else {
      id = APPLY
        ? (await db.query('INSERT INTO school_classes (schoolId, academicYear, name, gradeLevel) VALUES (?, ?, ?, ?)', [schoolId, ACADEMIC_YEAR, name, gradeOf(name)]))[0].insertId
        : fakeId(ctx);
      classes.set(key, id);
      s5.yangi++;
    }
    maps.klass.set(row.id, id);
    maps.klassSchool.set(row.id, schoolId);
  }
  report.distributions.sinfNomlari = { tozalanganlar: nameChanges.get('nom tozalandi (masalan 5-a → 5A)') ?? 0 };
  return { maps, classes };
}

// ───── odamlar: o‘quvchi va o‘qituvchi ─────

async function phasePeople(ctx, geo) {
  const { oldDb, db } = ctx;
  const { maps } = geo;
  const students = await select(
    oldDb,
    `SELECT id, firstname, lastname, middlename, jinsi, \`national\`, birthday, pnfl, leaveAddress, mahallaId,
            father, fatherPhone, mather, matherPhone, schoolId, classId, updatedAt
       FROM Students`,
  );
  const teachers = await select(
    oldDb,
    `SELECT id, firstname, lastname, middlename, jinsi, \`national\`, birthday, pnfl, leaveAddress,
            lavozimi, phoneNumber, schoolId, classId, updatedAt
       FROM Teachers`,
  );

  const skippedGuardians = new Map();
  const genderRaw = new Map(), nationalRaw = new Map(), birthPatterns = new Map(), phonePatterns = new Map(), badPhonePatterns = new Map();
  const nationalVariants = new Set();
  const dist = report.distributions;

  /** Qatorlarni tozalab, nomzodlarga aylantiradi. */
  function prepare(rows, type) {
    const entity = type === 'STUDENT' ? 'Students' : 'Teachers';
    const stat = { eski: rows.length, yaroqli: 0, jshshirYoq: 0, takrorJshshir: 0, ismYoq: 0, maktabYoq: 0, sinfYoq: 0, sinfBoshqaMaktab: 0 };
    const byPnfl = new Map();
    for (const row of rows) {
      const pnfl = normPnfl(row.pnfl);
      if (!pnfl) { problem(entity, row.id, 'BAD_PNFL'); stat.jshshirYoq++; continue; }
      const firstName = clean(row.firstname).slice(0, 100);
      const lastName = clean(row.lastname).slice(0, 100);
      if (!firstName || !lastName) { problem(entity, row.id, 'NO_NAME'); stat.ismYoq++; continue; }
      const schoolId = maps.school.get(row.schoolId);
      if (!schoolId) { problem(entity, row.id, 'NO_SCHOOL'); stat.maktabYoq++; continue; }

      const gender = normGender(row.jinsi);
      tally(genderRaw, `${type}:${clean(row.jinsi) || '(bo‘sh)'} → ${gender === undefined ? 'TANILMADI' : (gender ?? '—')}`);
      const birthDate = normBirth(row.birthday);
      tally(birthPatterns, `${pattern(row.birthday)} → ${birthDate === undefined ? 'TANILMADI' : birthDate === null ? '—' : 'ok'}`);
      if (birthDate === undefined) problem(entity, row.id, 'BAD_BIRTHDATE');
      if (gender === undefined) problem(entity, row.id, 'BAD_GENDER');
      tally(nationalRaw, normNational(row.national) ?? '(bo‘sh)');
      nationalVariants.add(clean(row.national));

      const candidate = {
        legacyId: row.id,
        type,
        pnfl,
        firstName,
        lastName,
        middleName: clean(row.middlename).slice(0, 100) || null,
        gender: gender ?? null,
        nationality: normNational(row.national),
        birthDate: birthDate ?? null,
        address: clean(row.leaveAddress).slice(0, 500) || null,
        phoneNumber: type === 'TEACHER' ? normPhone(row.phoneNumber) : null,
        mahallaId: type === 'STUDENT' ? (maps.mahalla.get(row.mahallaId) ?? null) : null,
        schoolId,
        classId: maps.klass.get(row.classId) ?? null,
        oldClassId: row.classId,
        position: type === 'TEACHER' ? clean(row.lavozimi).slice(0, 150) || null : null,
        updatedAt: row.updatedAt ?? '',
        guardians: [],
      };
      if (candidate.classId && maps.klassSchool.get(row.classId) !== schoolId) {
        // Sinf boshqa maktabga tegishli: noto‘g‘ri bog‘lamaslik uchun sinfsiz qoldiriladi.
        problem(entity, row.id, 'CLASS_OTHER_SCHOOL');
        stat.sinfBoshqaMaktab++;
        candidate.classId = null;
      }
      if (type === 'STUDENT') {
        if (!candidate.classId) { problem(entity, row.id, 'NO_CLASS'); stat.sinfYoq++; }
        candidate.guardianScan = true;
        for (const [relation, name, phoneRaw] of [['FATHER', row.father, row.fatherPhone], ['MOTHER', row.mather, row.matherPhone]]) {
          const phone = normPhone(phoneRaw);
          tally(phonePatterns, `${relation}:${clean(phoneRaw) ? (phone ? 'ok' : 'YAROQSIZ') : '(bo‘sh)'}`);
          if (clean(phoneRaw) && !phone) {
            problem(entity, row.id, `BAD_${relation}_PHONE`);
            tally(badPhonePatterns, `${pattern(phoneRaw)}  (${digits(phoneRaw).length} raqam)`);
          }
          const nameProblem = guardianNameProblem(name);
          const phoneProblem = phone ? null : clean(phoneRaw) ? 'telefon yaroqsiz yoki raqami kam' : 'telefon bo‘sh';
          const keep = !nameProblem && !phoneProblem
            ? true
            : (KEEP_PHONE_ONLY && Boolean(nameProblem) && !phoneProblem) || (KEEP_NAME_ONLY && !nameProblem && Boolean(phoneProblem));
          if (!keep) {
            tally(skippedGuardians, `${relation}: ${[nameProblem, phoneProblem].filter(Boolean).join(' + ')}`);
            continue;
          }
          const names = nameProblem ? { lastName: null, firstName: null, middleName: null } : splitName(name);
          if (phone || names.firstName) candidate.guardians.push({ relation, phone, ...names });
        }
      } else if (row.phoneNumber && !candidate.phoneNumber) {
        problem(entity, row.id, 'BAD_PHONE');
        tally(badPhonePatterns, `O‘QITUVCHI ${pattern(row.phoneNumber)}  (${digits(row.phoneNumber).length} raqam)`);
      }

      if (candidate.guardianScan && candidate.guardians.length === 0) stat.otaOnasiz = (stat.otaOnasiz ?? 0) + 1;
      const prev = byPnfl.get(pnfl);
      if (prev) {
        stat.takrorJshshir++;
        problem(entity, row.id, 'DUP_PNFL');
        if (candidate.updatedAt <= prev.updatedAt) continue; // yangisi qoladi
      }
      byPnfl.set(pnfl, candidate);
    }
    stat.yaroqli = byPnfl.size;
    report.people[type === 'STUDENT' ? 'oquvchi' : 'oqituvchi'] = stat;
    return [...byPnfl.values()];
  }

  const studentList = prepare(students, 'STUDENT');
  const teacherList = prepare(teachers, 'TEACHER');
  dist.jins = top(genderRaw, 20);
  dist.tugilganKunShakllari = top(birthPatterns, 12);
  dist.otaOnaTashlandi = top(skippedGuardians, 16);
  dist.otaOnaTashlandiJami = [...skippedGuardians.values()].reduce((a, b) => a + b, 0);
  dist.millat = top(nationalRaw, 15);
  dist.millatYozilishlariSoni = { eski: nationalVariants.size, birlashtirilgan: nationalRaw.size };
  dist.yaroqsizTelefonShakllari = top(badPhonePatterns, 15);
  dist.otaOnaTelefon = top(phonePatterns, 8);

  // Bir JShShIR ham o‘quvchi, ham o‘qituvchi bo‘lsa — bitta shaxs, ikkita a’zolik.
  const personsByPnfl = new Map();
  for (const c of [...teacherList, ...studentList]) if (!personsByPnfl.has(c.pnfl)) personsByPnfl.set(c.pnfl, c);
  const pnflAll = [...personsByPnfl.keys()];

  // Yangi bazada allaqachon bor shaxslar
  const existingIds = new Map();
  const deleted = new Set();
  for (let i = 0; i < pnflAll.length; i += CHUNK) {
    const slice = pnflAll.slice(i, i + CHUNK);
    for (const r of await select(db, 'SELECT id, pnfl, deletedAt FROM persons WHERE pnfl IN (?)', [slice])) {
      if (r.deletedAt) deleted.add(r.pnfl);
      else existingIds.set(r.pnfl, r.id);
    }
  }
  for (const pnfl of deleted) problem('Person', personsByPnfl.get(pnfl).legacyId, 'PERSON_SOFT_DELETED');

  const toCreate = pnflAll.filter((p) => !existingIds.has(p) && !deleted.has(p));
  report.people.shaxslar = { jami: pnflAll.length, yangi: toCreate.length, mavjud: existingIds.size, ochirilgan: deleted.size };

  // Shaxslarni yozish
  if (APPLY) {
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const rows = toCreate.slice(i, i + CHUNK).map((p) => {
        const c = personsByPnfl.get(p);
        return [c.pnfl, c.firstName, c.lastName, c.middleName, c.gender, c.nationality, c.birthDate, c.address, c.phoneNumber, c.mahallaId];
      });
      await insertChecked(
        db,
        'persons',
        'INSERT INTO persons (pnfl, firstName, lastName, middleName, gender, nationality, birthDate, address, phoneNumber, mahallaId) VALUES ?',
        rows,
      );
    }
    for (let i = 0; i < pnflAll.length; i += CHUNK) {
      for (const r of await select(db, 'SELECT id, pnfl FROM persons WHERE pnfl IN (?) AND deletedAt IS NULL', [pnflAll.slice(i, i + CHUNK)])) existingIds.set(r.pnfl, r.id);
    }
  }

  // A’zoliklar: shu odam shu maktabda shu turda allaqachon a’zo bo‘lsa, qo‘shilmaydi.
  const all = [...studentList, ...teacherList].filter((c) => !deleted.has(c.pnfl));
  const personIds = [...new Set(all.map((c) => existingIds.get(c.pnfl)).filter((id) => id !== undefined))];
  const hasMembership = new Set();
  for (let i = 0; i < personIds.length; i += CHUNK) {
    for (const r of await select(db, 'SELECT personId, schoolId, type FROM school_memberships WHERE personId IN (?)', [personIds.slice(i, i + CHUNK)])) {
      hasMembership.add(`${r.personId}|${r.schoolId}|${r.type}`);
    }
  }
  const memberRows = [];
  let memberExisting = 0;
  const seen = new Set();
  for (const c of all) {
    const personId = existingIds.get(c.pnfl);
    const key = `${personId}|${c.schoolId}|${c.type}`;
    if (personId !== undefined && hasMembership.has(key)) { memberExisting++; continue; }
    if (seen.has(`${c.pnfl}|${c.schoolId}|${c.type}`)) continue;
    seen.add(`${c.pnfl}|${c.schoolId}|${c.type}`);
    memberRows.push({ c, personId });
  }
  report.people.azolik = { yangi: memberRows.length, mavjud: memberExisting };

  if (APPLY && memberRows.length) {
    for (let i = 0; i < memberRows.length; i += CHUNK) {
      const rows = memberRows.slice(i, i + CHUNK).map(({ c, personId }) => [personId, c.schoolId, c.type, START_DATE, c.classId]);
      await insertChecked(db, 'school_memberships', 'INSERT INTO school_memberships (personId, schoolId, type, startDate, classId) VALUES ?', rows);
    }
  }

  // Ota-onalar
  const guardianRows = [];
  const guardianExisting = new Set();
  for (let i = 0; i < personIds.length; i += CHUNK) {
    for (const r of await select(db, 'SELECT personId, relation FROM person_guardians WHERE personId IN (?)', [personIds.slice(i, i + CHUNK)])) guardianExisting.add(`${r.personId}|${r.relation}`);
  }
  for (const c of studentList) {
    const personId = existingIds.get(c.pnfl);
    for (const g of c.guardians) {
      if (personId !== undefined && guardianExisting.has(`${personId}|${g.relation}`)) continue;
      guardianRows.push({ personId, g });
    }
  }
  report.people.otaOna = { yangi: guardianRows.length, telefonli: guardianRows.filter((r) => r.g.phone).length };
  const guardianKinds = new Map();
  for (const { personId, g } of guardianRows) {
    tally(guardianKinds, `${g.relation} ${g.phone ? 'telefonli' : 'faqat ismli'} ${personId === undefined ? '(yangi shaxs)' : '(mavjud shaxs)'}`);
  }
  report.distributions.yetishmaydiganOtaOna = top(guardianKinds, 12);
  if (APPLY && guardianRows.length) {
    for (let i = 0; i < guardianRows.length; i += CHUNK) {
      const rows = guardianRows.slice(i, i + CHUNK).map(({ personId, g }) => [personId, g.relation, g.lastName, g.firstName, g.middleName, g.phone]);
      await insertChecked(db, 'person_guardians', 'INSERT INTO person_guardians (personId, relation, lastName, firstName, middleName, phoneNumber) VALUES ?', rows);
    }
  }

  // O‘qituvchi lavozimi
  const withPosition = teacherList.filter((c) => c.position && !deleted.has(c.pnfl));
  report.people.lavozim = { yangi: 0, mavjud: 0 };
  if (withPosition.length) {
    const tIds = withPosition.map((c) => existingIds.get(c.pnfl)).filter((id) => id !== undefined);
    const memberships = [];
    for (let i = 0; i < tIds.length; i += CHUNK) {
      memberships.push(...(await select(db, "SELECT id, personId, schoolId FROM school_memberships WHERE type = 'TEACHER' AND personId IN (?)", [tIds.slice(i, i + CHUNK)])));
    }
    const membershipOf = new Map(memberships.map((m) => [`${m.personId}|${m.schoolId}`, m.id]));
    const detailExisting = new Set();
    const mIds = memberships.map((m) => m.id);
    for (let i = 0; i < mIds.length; i += CHUNK) {
      for (const r of await select(db, 'SELECT membershipId FROM teacher_membership_details WHERE membershipId IN (?)', [mIds.slice(i, i + CHUNK)])) detailExisting.add(r.membershipId);
    }
    const detailRows = [];
    for (const c of withPosition) {
      const mId = membershipOf.get(`${existingIds.get(c.pnfl)}|${c.schoolId}`);
      if (mId && detailExisting.has(mId)) report.people.lavozim.mavjud++;
      else if (mId) detailRows.push([mId, c.position]);
      else if (!APPLY) report.people.lavozim.yangi++; // dry-run: a’zolik hali yo‘q, yozilganda qo‘shiladi
    }
    if (APPLY && detailRows.length) {
      for (let i = 0; i < detailRows.length; i += CHUNK) await insertChecked(db, 'teacher_membership_details', 'INSERT INTO teacher_membership_details (membershipId, position) VALUES ?', detailRows.slice(i, i + CHUNK));
    }
    if (APPLY) report.people.lavozim.yangi = detailRows.length;
  }

  // Sinf rahbarlari (ixtiyoriy)
  if (TEACHER_CLASS_HOMEROOM) {
    const byClass = new Map();
    for (const c of teacherList) if (c.classId) (byClass.get(c.classId) ?? byClass.set(c.classId, []).get(c.classId)).push(c);
    let set = 0, conflict = 0;
    for (const [classId, list] of byClass) {
      if (list.length > 1) { conflict++; problem('Teachers', list[0].legacyId, 'HOMEROOM_CONFLICT'); continue; }
      const personId = existingIds.get(list[0].pnfl);
      if (APPLY && personId !== undefined && classId > 0) {
        const [res] = await db.query('UPDATE school_classes SET homeroomPersonId = ? WHERE id = ? AND homeroomPersonId IS NULL', [personId, classId]);
        set += res.affectedRows;
      } else set++;
    }
    report.people.sinfRahbari = { belgilandi: set, toqnashuv: conflict };
  }
}

// ───────────────────────── yakun ─────────────────────────

function finish() {
  report.finishedAt = new Date().toISOString();
  report.problemCounts = Object.fromEntries(top(problemCounts, 100));

  console.log('─── NATIJA ───');
  console.log('Geografiya (eski / yangi qo‘shiladi / mavjud / tashlandi):');
  for (const [name, s] of Object.entries(report.geo)) {
    console.log(`  ${name.padEnd(9)} ${String(s.eski).padStart(6)} / ${String(s.yangi).padStart(6)} / ${String(s.mavjud).padStart(6)} / ${String(s.tashlandi).padStart(4)}`);
  }
  for (const [name, s] of Object.entries(report.people)) console.log(`${name}: ${JSON.stringify(s)}`);
  console.log('\nMuammolar (soni):');
  for (const [key, n] of Object.entries(report.problemCounts)) console.log(`  ${key.padEnd(34)} ${n}`);
  if (!problems.length) console.log('  (yo‘q)');
  console.log('\nQiymatlar taqsimoti (moslashtirish to‘g‘riligini tekshirish uchun):');
  for (const [name, list] of Object.entries(report.distributions)) {
    console.log(`  ${name}:`);
    if (Array.isArray(list)) for (const [k, n] of list) console.log(`    ${String(n).padStart(7)}  ${k}`);
    else console.log(`    ${JSON.stringify(list)}`);
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = path.join(REPORT_DIR, `legacy-${report.mode.toLowerCase()}-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  fs.writeFileSync(`${base}-problems.csv`, ['entity,legacyId,code', ...problems.map((p) => p.join(','))].join('\n'), { mode: 0o600 });
  console.log(`\nHisobot: ${base}.json`);
  console.log(`Muammolar ro‘yxati (shaxsiy ma’lumotsiz): ${base}-problems.csv`);
  console.log(APPLY ? '\nYOZILDI. Tekshirib chiqing.' : '\nBu QURUQ rejim edi: hech narsa yozilmadi. Yozish uchun: --apply --confirm-backup');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nXATO: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { normNational, normPhone, normGender, normBirth, normClassName, guardianNameProblem };
