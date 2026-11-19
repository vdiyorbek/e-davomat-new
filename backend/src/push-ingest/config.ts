import { config as loadEnv } from 'dotenv';
import { availableParallelism } from 'node:os';

loadEnv({ path: '.env', quiet: true });

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} ${min}–${max} oralig‘idagi butun son bo‘lishi kerak`,
    );
  }
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} .env faylida ko‘rsatilmagan`);
  return value;
}

export function loadPushConfig() {
  return {
    host: process.env.PUSH_HOST || '0.0.0.0',
    port: int('PUSH_PORT', 3001, 1, 65535),
    workers: int('PUSH_WORKERS', Math.min(availableParallelism(), 4), 1, 64),

    /** Bitta HTTP so‘rov hajmi (rasm bilan). */
    bodyLimit: int(
      'PUSH_BODY_LIMIT_BYTES',
      2 * 1024 * 1024,
      64 * 1024,
      16 * 1024 * 1024,
    ),
    /** Bir ingest jarayonida bir vaqtda ishlanayotgan so‘rovlar chegarasi. */
    maxInFlight: int('PUSH_MAX_IN_FLIGHT', 2000, 10, 100_000),
    /** Bitta terminal uchun soniyasiga ruxsat etilgan so‘rovlar. */
    perTerminalRps: int('PUSH_MAX_RPS_PER_TERMINAL', 30, 1, 10_000),
    /** Navbatda shundan ko‘p event bo‘lsa — 503 (terminal keyin qayta yuboradi). */
    maxBacklog: int('PUSH_MAX_BACKLOG', 1_000_000, 1000, 100_000_000),
    /** Rasmlarni saqlash: false bo‘lsa faqat pictureURL orqali yuklanadi. */
    savePictures: process.env.PUSH_SAVE_PICTURES !== 'false',
    storageRoot: process.env.PUSH_STORAGE_ROOT || process.cwd(),
    terminalsReloadMs: int('PUSH_TERMINALS_RELOAD_MS', 30_000, 1000, 3_600_000),

    db: {
      host: required('DB_HOST'),
      port: int('DB_PORT', 3306, 1, 65535),
      user: required('DB_USERNAME'),
      password: required('DB_PASSWORD'),
      database: required('DB_DATABASE'),
    },
    redis: {
      host: required('REDIS_HOST'),
      port: int('REDIS_PORT', 6379, 1, 65535),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
    },
  };
}

export type PushConfig = ReturnType<typeof loadPushConfig>;
