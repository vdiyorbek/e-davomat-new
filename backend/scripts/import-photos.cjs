#!/usr/bin/env node
'use strict';

/**
 * Eski platformadagi o‘quvchi/o‘qituvchi rasmlarini yangi tizimga ko‘chirish.
 *
 * Har rasm yangi tizimning odatiy yuklash qoidalari bo‘yicha tekshiriladi va tayyorlanadi
 * (PersonPhotosService bilan bir xil): JPEG/PNG/WebP, kamida 640×480, 480×640 yoki 640×480 ga
 * moslab, 199 KB dan kichik JPEG, yorug‘lik va aniqlik tekshiruvi. Saqlash: uploads/persons/<uuid>.jpg,
 * persons.photoUrl = /api/persons/<id>/photo?v=<uuid>.
 *
 * Ishlatish (backend papkasidan; `.env` shu yerdan o‘qiladi):
 *
 *   OLD_DB_USER=legacy_ro OLD_DB_PASSWORD=... node scripts/import-photos.cjs --photos-root=/eski/rasmlar/papkasi
 *       → QURUQ rejim: rasmlarni tekshiradi va hisobot beradi, hech narsa yozilmaydi
 *   ... node scripts/import-photos.cjs --photos-root=... --apply --confirm-backup
 *
 * Xavfsizlik:
 *  • Eski bazadan faqat JShShIR va rasm yo‘li o‘qiladi; eski rasm fayllariga faqat o‘qish.
 *  • Faqat rasmi YO‘Q shaxslarga yoziladi; mavjud rasm hech qachon almashtirilmaydi.
 *  • Takror ishga tushirish xavfsiz (rasmi borlar o‘tkazib yuboriladi).
 *  • Hisobotlarda shaxsiy ma’lumot yo‘q: faqat eski ID va muammo kodi.
 *
 * Sozlamalar:
 *   --photos-root=PAPKA     eski rasmlar turgan papka (majburiy)
 *   --only=students|teachers  faqat o‘quvchi yoki faqat o‘qituvchi
 *   --limit=200             sinov uchun: faqat dastlabki N ta shaxs
 *   --concurrency=6         bir vaqtda ishlanadigan rasmlar soni
 *   --accept-all            HAMMA o‘qiladigan rasmni o‘tkazadi; sifat muammolari (xira, kichik, qorong‘i…) rad etilmaydi, belgilanadi
 *   --relax                 yumshoq rejim: kichikroq o‘lcham (300×400) va yorug‘lik/aniqlik tekshiruvisiz
 *   --report-dir=./import-reports
 */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { randomUUID } = require('node:crypto');

for (const dir of [process.cwd(), path.resolve(__dirname, '..')]) {
  const envFile = path.join(dir, '.env');
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile, quiet: true });
    break;
  }
}
const mysql = require('mysql2/promise');
const sharp = require('sharp');
sharp.cache(false);
sharp.concurrency(2);

// ───────────────────────── sozlamalar ─────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? true] : [arg, true];
  }),
);
const APPLY = args.apply === true;
const CONFIRMED = args['confirm-backup'] === true;
const RELAX = args.relax === true;
const ACCEPT_ALL = args['accept-all'] === true;
const LIMIT = Number(args.limit || 0);
const CONCURRENCY = Math.min(Math.max(Number(args.concurrency || 6), 1), 24);
const ONLY = typeof args.only === 'string' ? args.only : '';
const ROOT = typeof args['photos-root'] === 'string' ? path.resolve(args['photos-root']) : '';
const REPORT_DIR = path.resolve(typeof args['report-dir'] === 'string' ? args['report-dir'] : './import-reports');
const TARGET_DIR = path.join(process.cwd(), 'uploads', 'persons');

// Yangi tizim bilan bir xil chegaralar (person-photos.service.ts, face-photo-quality.service.ts)
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // yuklashda 5 MB; ko‘chirishda kattaroq ham qabul, chunki kichraytiriladi
const MAX_PIXELS = 25_000_000;
const MAX_OUTPUT_BYTES = 199 * 1024;
const MIN_SHORT = RELAX ? 300 : 480;
const MIN_LONG = RELAX ? 400 : 640;
const QUALITY_CHECK = !RELAX;
const LENIENT = RELAX || ACCEPT_ALL;

function fail(message) {
  console.error(`XATO: ${message}`);
  process.exit(1);
}
if (!ROOT) fail('--photos-root=/eski/rasmlar/papkasi berilishi kerak');
if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) fail(`Papka topilmadi: ${ROOT}`);
if (ONLY && !['students', 'teachers'].includes(ONLY)) fail('--only=students yoki --only=teachers bo‘lishi kerak');
if (APPLY && !CONFIRMED) fail('Yozishdan oldin zaxira oling va `--confirm-backup` bayrog‘ini qo‘shing');

// ───────────────────────── yordamchilar ─────────────────────────

const clean = (v) => (v == null ? '' : String(v).trim());
const normPnfl = (v) => {
  const d = clean(v).replace(/\D/g, '');
  return d.length === 14 ? d : null;
};
function tally(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}
const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);

/** Bazadagi qiymatdan (yo‘l yoki URL) papka ichidagi mumkin bo‘lgan nisbiy yo‘llar. */
function relCandidates(value) {
  let v = clean(value);
  try {
    if (/^https?:\/\//i.test(v)) v = decodeURIComponent(new URL(v).pathname);
  } catch {
    /* URL emas */
  }
  v = v.replace(/\\/g, '/').split('?')[0].replace(/^\/+/, '');
  const list = new Set([v, v.replace(/^(public|static)\//, ''), v.replace(/^(public\/)?uploads\//, ''), path.basename(v)]);
  return [...list].filter(Boolean);
}

let basenameIndex = null;
async function buildIndex() {
  const index = new Map();
  async function walk(dir) {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const key = entry.name.toLowerCase();
        if (!index.has(key)) index.set(key, full);
      }
    }
  }
  await walk(ROOT);
  return index;
}

const inside = (full) => {
  const rel = path.relative(ROOT, full);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

async function resolveFile(value) {
  for (const rel of relCandidates(value)) {
    const full = path.resolve(ROOT, rel);
    if (!inside(full)) continue; // «../» orqali papkadan chiqishga yo‘l qo‘yilmaydi
    try {
      if ((await fsp.stat(full)).isFile()) return { full, how: 'yo‘l bo‘yicha' };
    } catch {
      /* keyingisi */
    }
  }
  basenameIndex = basenameIndex ?? (await buildIndex());
  const hit = basenameIndex.get(path.basename(clean(value).replace(/\\/g, '/').split('?')[0]).toLowerCase());
  return hit ? { full: hit, how: 'fayl nomi bo‘yicha' } : null;
}

/** Rasm tekshiruvi va tayyorlash: yangi tizim bilan bir xil. */
async function analyze(input) {
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: LENIENT ? 'error' : 'warning' }).metadata();
  } catch {
    return { ok: false, reason: 'UNREADABLE' };
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return { ok: false, reason: 'BAD_FORMAT' };
  if ((meta.pages ?? 1) !== 1) return { ok: false, reason: 'ANIMATED' };
  const rotated = [5, 6, 7, 8].includes(meta.orientation ?? 1);
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const flags = [];
  const shortSide = Math.min(width ?? 0, height ?? 0);
  if (!width || !height || shortSide < MIN_SHORT || Math.max(width, height) < MIN_LONG) {
    if (!ACCEPT_ALL || !width || !height) return { ok: false, reason: 'TOO_SMALL', shortSide };
    flags.push('TOO_SMALL');
  }

  if (QUALITY_CHECK) {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'warning' })
      .rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    let sum = 0;
    for (let i = 0; i < pixels; i++) sum += data[i];
    const brightness = sum / pixels;
    let gradient = 0;
    let count = 0;
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const i = y * info.width + x;
        const dx = data[i + 1] - data[i - 1];
        const dy = data[i + info.width] - data[i - info.width];
        gradient += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }
    const sharpness = count ? gradient / count : 0;
    const found = [];
    if (brightness < 50) found.push('TOO_DARK');
    if (brightness > 210) found.push('TOO_BRIGHT');
    if (sharpness < 8) found.push('BLURRY');
    if (found.length && !ACCEPT_ALL) return { ok: false, reason: found[0] };
    flags.push(...found);
  }

  const portrait = height > width;
  const outW = portrait ? 480 : 640;
  const outH = portrait ? 640 : 480;
  for (const quality of [98, 95, 92, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
    const output = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: LENIENT ? 'error' : 'warning' })
      .rotate()
      .resize(outW, outH, { fit: 'contain', background: '#ffffff', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, progressive: false, mozjpeg: true })
      .toBuffer();
    if (output.length <= MAX_OUTPUT_BYTES) return { ok: true, output, flags, shortSide };
  }
  return { ok: false, reason: 'CANNOT_FIT_200KB' };
}

// ───────────────────────── asosiy ish ─────────────────────────

async function main() {
  if (!process.env.OLD_DB_USER) fail('OLD_DB_USER va OLD_DB_PASSWORD berilishi kerak');
  for (const name of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (!process.env[name]) fail(`${name} topilmadi: skriptni backend papkasidan ishga tushiring (.env shu yerda)`);
  }
  const oldDb = await mysql.createPool({
    host: process.env.OLD_DB_HOST || '127.0.0.1',
    port: Number(process.env.OLD_DB_PORT || 3306),
    user: process.env.OLD_DB_USER,
    password: process.env.OLD_DB_PASSWORD,
    database: process.env.OLD_DB_NAME || 'davomat-new',
    charset: 'utf8mb4',
    connectionLimit: 2,
  });
  const db = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    charset: 'utf8mb4',
    connectionLimit: CONCURRENCY + 1,
  });

  console.log(`Rejim: ${APPLY ? 'APPLY (yoziladi)' : 'DRY-RUN (faqat tekshiradi)'}${RELAX ? ', yumshoq' : ''}${ACCEPT_ALL ? ', hammasini qabul qilish' : ''}`);
  console.log(`Eski rasmlar papkasi: ${ROOT}`);
  console.log(`Yangi baza: ${process.env.DB_DATABASE}@${process.env.DB_HOST}; saqlash: ${TARGET_DIR}\n`);

  // 1) Eski bazadagi rasm yo‘llari
  const sources = [];
  if (ONLY !== 'teachers') {
    for (const r of (await oldDb.query("SELECT id, pnfl, studentPhoto AS photo FROM Students WHERE studentPhoto IS NOT NULL AND studentPhoto <> ''"))[0]) sources.push({ entity: 'Students', ...r });
  }
  if (ONLY !== 'students') {
    for (const r of (await oldDb.query("SELECT id, pnfl, teacherPhoto AS photo FROM Teachers WHERE teacherPhoto IS NOT NULL AND teacherPhoto <> ''"))[0]) sources.push({ entity: 'Teachers', ...r });
  }

  const report = { mode: APPLY ? 'APPLY' : 'DRY-RUN', relax: RELAX, acceptAll: ACCEPT_ALL, startedAt: new Date().toISOString(), jami: {}, sabablar: {}, qisqaTomon: {} };
  const rows = []; // [entity, legacyId, reason]
  const reasons = new Map();
  const shortSides = new Map();
  const how = new Map();
const flagTally = new Map();
const flagRows = []; // [personId, entity, legacyId, flag] — keyinchalik xabarnomalar uchun

  // 2) Yangi bazadagi shaxslar (JShShIR bo‘yicha), rasmi yo‘qlari
  const byPnfl = new Map();
  let badPnfl = 0;
  for (const s of sources) {
    const pnfl = normPnfl(s.pnfl);
    if (!pnfl) { badPnfl++; rows.push([s.entity, s.id, 'BAD_PNFL']); continue; }
    if (!byPnfl.has(pnfl)) byPnfl.set(pnfl, s);
  }
  const persons = [];
  const pnfls = [...byPnfl.keys()];
  let noPerson = 0, hasPhoto = 0;
  const found = new Set();
  for (let i = 0; i < pnfls.length; i += 1000) {
    const [list] = await db.query('SELECT id, pnfl, photoUrl, deletedAt FROM persons WHERE pnfl IN (?)', [pnfls.slice(i, i + 1000)]);
    for (const p of list) {
      found.add(p.pnfl);
      if (p.deletedAt) continue;
      if (p.photoUrl) { hasPhoto++; continue; }
      persons.push({ personId: p.id, ...byPnfl.get(p.pnfl) });
    }
  }
  noPerson = pnfls.length - found.size;
  persons.sort((a, b) => a.personId - b.personId);
  const work = LIMIT > 0 ? persons.slice(0, LIMIT) : persons;

  report.jami = {
    eskiBazadaRasmYoli: sources.length,
    jshshirYaroqsiz: badPnfl,
    yangiBazadaShaxsYoq: noPerson,
    rasmiBorShaxs: hasPhoto,
    ishlanadi: work.length,
  };
  console.log(`Eski bazada rasm yo‘li bor: ${sources.length}; yangi bazada shaxsi yo‘q: ${noPerson}; rasmi allaqachon bor: ${hasPhoto}; ishlanadi: ${work.length}\n`);

  // 3) Rasmlarni ishlash
  if (APPLY) await fsp.mkdir(TARGET_DIR, { recursive: true });
  let ok = 0, done = 0;
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= work.length) return;
      const item = work[index];
      let reason = null;
      try {
        const file = await resolveFile(item.photo);
        if (!file) reason = 'FILE_NOT_FOUND';
        else {
          tally(how, file.how);
          const stat = await fsp.stat(file.full);
          if (stat.size > MAX_INPUT_BYTES) reason = 'FILE_TOO_LARGE';
          else if (stat.size === 0) reason = 'EMPTY';
          else {
            const result = await analyze(await fsp.readFile(file.full));
            if (!result.ok) {
              reason = result.reason;
              if (reason === 'TOO_SMALL') {
                const s = result.shortSide;
                tally(shortSides, s < 200 ? '<200' : s < 300 ? '200-299' : s < 400 ? '300-399' : '400-479');
              }
            } else {
              for (const flag of result.flags) {
                tally(flagTally, flag);
                flagRows.push([item.personId, item.entity, item.id, flag]);
              }
            }
            if (result.ok && APPLY) {
              const version = randomUUID();
              const target = path.join(TARGET_DIR, `${version}.jpg`);
              await fsp.writeFile(target, result.output, { flag: 'wx' });
              const photoUrl = `/api/persons/${item.personId}/photo?v=${version}`;
              const [res] = await db.query('UPDATE persons SET photoUrl = ? WHERE id = ? AND deletedAt IS NULL AND photoUrl IS NULL', [photoUrl, item.personId]);
              if (res.affectedRows !== 1) {
                await fsp.unlink(target).catch(() => undefined);
                reason = 'CONFLICT';
              }
            }
          }
        }
      } catch (error) {
        reason = 'ERROR';
        console.error(`  ${item.entity} #${item.id}: ${String(error.message).slice(0, 120)}`);
      }
      done++;
      if (reason) { tally(reasons, reason); rows.push([item.entity, item.id, reason]); } else ok++;
      if (done % 500 === 0) console.log(`  ${done}/${work.length} ishlandi, yaroqli: ${ok}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 4) Hisobot
  report.natija = { yaroqli: ok, yaroqsiz: work.length - ok, ishlandi: work.length };
  report.sabablar = Object.fromEntries(sorted(reasons));
  report.qisqaTomon = Object.fromEntries(sorted(shortSides));
  report.sifatBelgilari = Object.fromEntries(sorted(flagTally));
  report.faylTopilishi = Object.fromEntries(sorted(how));
  report.finishedAt = new Date().toISOString();

  console.log('\n─── NATIJA ───');
  console.log(`Ishlandi: ${work.length}  |  ${APPLY ? 'YOZILDI' : 'yaroqli (yozilmadi)'}: ${ok}  |  yaroqsiz: ${work.length - ok}`);
  console.log('Yaroqsizlik sabablari:');
  for (const [k, n] of sorted(reasons)) console.log(`  ${String(n).padStart(7)}  ${k}`);
  if (shortSides.size) {
    console.log('Juda kichik rasmlarning qisqa tomoni (piksel):');
    for (const [k, n] of sorted(shortSides)) console.log(`  ${String(n).padStart(7)}  ${k}`);
  }
  if (flagTally.size) {
    console.log('Sifat belgilari (rasm yozildi/yoziladi, lekin maktab almashtirishi kerak):');
    for (const [k, n] of sorted(flagTally)) console.log(`  ${String(n).padStart(7)}  ${k}`);
  }
  console.log('Fayl qanday topildi:');
  for (const [k, n] of sorted(how)) console.log(`  ${String(n).padStart(7)}  ${k}`);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = path.join(REPORT_DIR, `photos-${report.mode.toLowerCase()}-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  fs.writeFileSync(`${base}-problems.csv`, ['entity,legacyId,code', ...rows.map((r) => r.join(','))].join('\n'), { mode: 0o600 });
  if (flagRows.length) fs.writeFileSync(`${base}-flags.csv`, ['personId,entity,legacyId,flag', ...flagRows.map((r) => r.join(','))].join('\n'), { mode: 0o600 });
  console.log(`\nHisobot: ${base}.json\nMuammolar ro‘yxati: ${base}-problems.csv${flagRows.length ? `\nSifat belgilari (shaxs bo‘yicha): ${base}-flags.csv` : ''}`);
  console.log(APPLY ? '\nYOZILDI.' : '\nBu QURUQ rejim edi: hech narsa yozilmadi. Yozish uchun: --apply --confirm-backup');

  await oldDb.end();
  await db.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nXATO: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { relCandidates, analyze };
