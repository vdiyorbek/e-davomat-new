/**
 * Hikvision HTTP Push qabul qiluvchi alohida server.
 *
 *   node dist/push-ingest/main.js
 *
 * Asosiy API (PORT) dan alohida portda (PUSH_PORT) ishlaydi va
 * PUSH_WORKERS ta CPU yadrosida cluster rejimida tinglaydi.
 */
import cluster from 'node:cluster';
import { Redis } from 'ioredis';
import { createPool } from 'mysql2/promise';

import {
  PUSH_ABORTED_KEY_PREFIX,
  PUSH_TERMINALS_CHANGED_CHANNEL,
  tashkentDate,
} from '../modules/hikvision-push/hikvision-push.types';
import { loadPushConfig } from './config';
import { PhotoStore } from './photo-store';
import { defaultRuntime, refreshRuntime } from './runtime-settings';
import { createPushServer } from './server';
import { TerminalRegistry } from './terminal-registry';

const config = loadPushConfig();

function log(level: 'log' | 'warn' | 'error', message: string): void {
  console[level](
    `[push-ingest ${process.pid}] ${new Date().toISOString()} ${message}`,
  );
}

function startPrimary(): void {
  log(
    'log',
    `${config.workers} ta jarayon ishga tushirilmoqda, port ${config.port}`,
  );

  let shuttingDown = false;
  for (let i = 0; i < config.workers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    log(
      'warn',
      `Jarayon ${worker.process.pid} to‘xtadi (${signal ?? code}), qayta ishga tushirilmoqda`,
    );
    setTimeout(() => cluster.fork(), 1000);
  });

  const stop = () => {
    shuttingDown = true;
    for (const worker of Object.values(cluster.workers ?? {}))
      worker?.process.kill('SIGTERM');
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

async function startWorker(): Promise<void> {
  const pool = createPool({
    ...config.db,
    connectionLimit: 2,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
  });

  const redisOptions = {
    ...config.redis,
    connectTimeout: 5000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 1,
    // Redis uzilganda so‘rovlar xotirada to‘planmaydi — darhol 503.
    enableOfflineQueue: false,
  };
  const redis = new Redis(redisOptions);
  // Obuna ulanishida ready-check (INFO) o‘chiriladi: SUBSCRIBE ulanish
  // tayyor bo‘lishidan oldin ketsa, Redis INFO’ni rad etadi, ulanish
  // uziladi va obuna jimgina yo‘qoladi.
  const subscriber = new Redis({
    ...redisOptions,
    enableOfflineQueue: true,
    enableReadyCheck: false,
    commandTimeout: undefined,
  });
  redis.on('error', () => log('error', 'Redis ulanishida xatolik'));
  subscriber.on('error', () =>
    log('warn', 'Redis obuna ulanishida xatolik (tokenlar davriy yangilanadi)'),
  );

  const registry = new TerminalRegistry(pool);
  await registry.reload();

  // Tizim sozlamalari (super administrator sahifasidan): har 15 soniyada yangilanadi.
  const runtime = defaultRuntime();
  const loadRuntime = () =>
    refreshRuntime(pool, runtime).catch(() =>
      log(
        'warn',
        'Tizim sozlamalarini yangilab bo‘lmadi (oxirgilari saqlanadi)',
      ),
    );
  await loadRuntime();
  const runtimeTimer = setInterval(() => void loadRuntime(), 15_000);
  log('log', `Push yoqilgan terminallar: ${registry.size}`);

  // Token yaratilganda/o‘chirilganda darhol yangilaymiz.
  await subscriber.subscribe(PUSH_TERMINALS_CHANGED_CHANNEL);
  subscriber.on('message', () => {
    registry
      .reload()
      .catch(() => log('warn', 'Terminallar ro‘yxatini yangilab bo‘lmadi'));
  });

  const reloadTimer = setInterval(() => {
    registry
      .reload()
      .catch(() => log('warn', 'Terminallar ro‘yxatini yangilab bo‘lmadi'));
  }, config.terminalsReloadMs);
  const flushTimer = setInterval(() => {
    void registry.flushReceived();
    void flushAborted();
  }, 30_000);

  /** Terminal bo‘yicha uzilishlar: kunlik Redis hash (Toshkent sanasi), 8 kun saqlanadi. */
  async function flushAborted(): Promise<void> {
    if (abortedByTerminal.size === 0) return;
    const batch = [...abortedByTerminal];
    abortedByTerminal.clear();
    const key = `${PUSH_ABORTED_KEY_PREFIX}${tashkentDate(new Date())}`;
    try {
      const pipeline = redis.pipeline();
      for (const [terminalId, count] of batch) {
        pipeline.hincrby(key, String(terminalId), count);
      }
      pipeline.expire(key, 8 * 24 * 3600);
      await pipeline.exec();
    } catch {
      log('warn', 'Uzilgan so‘rovlar sonini Redis’ga yozib bo‘lmadi');
    }
  }

  const { server, stats, abortedByTerminal } = createPushServer({
    config,
    registry,
    redis,
    photos: new PhotoStore(config.storageRoot),
    runtime,
    log,
  });

  const statsTimer = setInterval(() => {
    log(
      'log',
      `qabul=${stats.accepted} e’tiborsiz=${stats.ignored} rad=${stats.rejected} band=${stats.overloaded} uzilgan=${stats.aborted}`,
    );
    const reasons = Object.entries(stats.reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => `${key}=${count}`)
      .join(' ');
    if (reasons) log('log', `sabablar: ${reasons}`);
    stats.reasons = {};
    stats.accepted =
      stats.ignored =
      stats.rejected =
      stats.overloaded =
      stats.aborted =
        0;
  }, 60_000);

  server.listen(config.port, config.host);

  const shutdown = () => {
    clearInterval(reloadTimer);
    clearInterval(runtimeTimer);
    clearInterval(flushTimer);
    clearInterval(statsTimer);
    server.close(() => {
      void Promise.allSettled([registry.flushReceived(), flushAborted()])
        .finally(() =>
          Promise.allSettled([pool.end(), redis.quit(), subscriber.quit()]),
        )
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (cluster.isPrimary && config.workers > 1) {
  startPrimary();
} else {
  startWorker().catch((error: unknown) => {
    log(
      'error',
      `Ishga tushmadi: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    process.exit(1);
  });
}
