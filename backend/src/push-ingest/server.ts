import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Redis } from 'ioredis';

import {
  describeParts,
  normalizePush,
} from '../modules/hikvision-push/hikvision-push.parser';
import {
  PUSH_STREAM_KEY,
  type PushStreamEvent,
} from '../modules/hikvision-push/hikvision-push.types';
import type { PushConfig } from './config';
import type { PhotoStore } from './photo-store';
import type { PushRuntime } from './runtime-settings';
import type { PushTerminal } from './terminal-registry';

const PATH = /^\/(?:api\/)?hikvision-push\/([a-f0-9]{64})\/?$/i;
const CONTENT_TYPE =
  /^(multipart\/(form-data|mixed)|application\/(json|xml)|text\/xml)\b/i;

export interface IngestDeps {
  config: Pick<
    PushConfig,
    | 'bodyLimit'
    | 'maxInFlight'
    | 'perTerminalRps'
    | 'maxBacklog'
    | 'savePictures'
  >;
  registry: {
    find(tokenHash: string): PushTerminal | undefined;
    markReceived(terminalId: number): void;
  };
  redis: Pick<Redis, 'xadd' | 'xlen'>;
  photos: Pick<PhotoStore, 'save' | 'remove'>;
  /** Jonli o‘zgaradigan sozlamalar; berilmasa .env qiymatlari ishlatiladi. */
  runtime?: PushRuntime;
  log: (level: 'warn' | 'error', message: string) => void;
}

export interface IngestStats {
  accepted: number;
  ignored: number;
  rejected: number;
  overloaded: number;
  /** Qabul qilingan yuz eventlari: rasm bilan / faqat pictureURL / rasmsiz. */
  withPicture: number;
  withPictureUrl: number;
  withoutPicture: number;
  /** Terminal tanani to‘liq yubormay ulanishni uzgan so‘rovlar (aborted/ECONNRESET). */
  aborted: number;
}

/** Uzilgan so‘rovmi: klient tanani yuborib bo‘lmasdan ulanishni yopgan. */
export function isClientAbort(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { message, code } = error as { message?: unknown; code?: unknown };
  return (
    message === 'aborted' ||
    code === 'ECONNRESET' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE'
  );
}

function reply(res: ServerResponse, status: number, body: string): void {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...(status === 503 ? { 'Retry-After': '30' } : {}),
  });
  res.end(body);
}

const OK = '{"accepted":true}';

/** Tana hajmini oqim davomida tekshiradi: 2 MB dan oshsa darhol uziladi. */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit)
    return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        req.removeAllListeners('data');
        req.resume();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks, size)));
    req.on('error', reject);
    // Ba’zi Node versiyalarida uzilganda 'error' chiqmaydi, faqat 'close'.
    req.on('close', () => {
      if (!req.complete) reject(new Error('aborted'));
    });
  });
}

/**
 * Terminal eventlarini qabul qiluvchi yengil HTTP server.
 *
 * Har bir so‘rovda: token → xotiradagi terminal (MySQL yo‘q), event
 * ajratiladi, faqat yuz eventlari Redis Stream'ga bitta XADD bilan
 * yoziladi va darhol 200 qaytadi. Og‘ir ish (MySQL, davomat) — workerda.
 */
export function createPushServer(deps: IngestDeps): {
  server: Server;
  stats: IngestStats;
  /** Terminal bo‘yicha uzilishlar (oxirgi tozalashdan beri); tashqi oqim uni Redis'ga yozadi. */
  abortedByTerminal: Map<number, number>;
} {
  const { config, registry, redis, photos, log } = deps;
  const runtime: PushRuntime = deps.runtime ?? {
    savePictures: config.savePictures,
    perTerminalRps: config.perTerminalRps,
    maxBacklog: config.maxBacklog,
  };
  const stats: IngestStats = {
    accepted: 0,
    ignored: 0,
    rejected: 0,
    overloaded: 0,
    withPicture: 0,
    withPictureUrl: 0,
    withoutPicture: 0,
    aborted: 0,
  };
  const abortedByTerminal = new Map<number, number>();
  // Rasm yubormayotgan terminal haqida 10 daqiqada bir marta ogohlantiriladi.
  const noPictureWarnedAt = new Map<number, number>();

  let inFlight = 0;
  let backlog = 0;
  let backlogCheckedAt = 0;
  const buckets = new Map<number, { second: number; count: number }>();

  async function backlogFull(): Promise<boolean> {
    const now = Date.now();
    if (now - backlogCheckedAt > 1000) {
      backlogCheckedAt = now;
      backlog = await redis.xlen(PUSH_STREAM_KEY);
    }
    return backlog >= runtime.maxBacklog;
  }

  function rateLimited(terminalId: number): boolean {
    const second = Math.floor(Date.now() / 1000);
    const bucket = buckets.get(terminalId);
    if (!bucket || bucket.second !== second) {
      if (buckets.size > 100_000) buckets.clear();
      buckets.set(terminalId, { second, count: 1 });
      return false;
    }
    bucket.count += 1;
    return bucket.count > runtime.perTerminalRps;
  }

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = req.url ?? '';

    if (req.method === 'GET' && (url === '/health' || url === '/api/health')) {
      reply(
        res,
        200,
        JSON.stringify({ ok: true, inFlight, backlog, ...stats }),
      );
      return;
    }

    const match = PATH.exec(url.split('?')[0]);
    if (req.method !== 'POST' || !match) {
      stats.rejected++;
      req.resume();
      reply(res, 404, '{"message":"Not found"}');
      return;
    }

    const tokenHash = createHash('sha256')
      .update(match[1].toLowerCase(), 'utf8')
      .digest('hex');
    const terminal = registry.find(tokenHash);
    if (!terminal) {
      stats.rejected++;
      req.resume();
      reply(res, 401, '{"message":"Webhook autentifikatsiyasi rad etildi"}');
      return;
    }

    if (rateLimited(terminal.id)) {
      stats.overloaded++;
      req.resume();
      reply(res, 429, '{"message":"Juda ko‘p so‘rov"}');
      return;
    }

    const contentType = String(req.headers['content-type'] || '').slice(0, 200);
    if (!CONTENT_TYPE.test(contentType)) {
      stats.rejected++;
      req.resume();
      reply(res, 415, '{"message":"Content-Type qo‘llab-quvvatlanmaydi"}');
      return;
    }

    let body: Buffer | null;
    try {
      body = await readBody(req, config.bodyLimit);
    } catch (error: unknown) {
      if (isClientAbort(error)) {
        // Terminal ulanishni uzdi: javob berishning ma‘nosi yo‘q, qayta yuboradi.
        stats.aborted++;
        abortedByTerminal.set(
          terminal.id,
          (abortedByTerminal.get(terminal.id) ?? 0) + 1,
        );
        return;
      }
      throw error;
    }
    if (!body || body.length === 0) {
      stats.rejected++;
      reply(res, 413, '{"message":"HTTP body bo‘sh yoki hajmi oshgan"}');
      return;
    }

    registry.markReceived(terminal.id);

    const normalized = normalizePush(contentType, body);
    if (!normalized.ok) {
      // Heartbeat, eshik holati va boshqa eventlar: terminal qayta
      // yubormasligi uchun 200, lekin navbatga yozilmaydi.
      stats.ignored++;
      reply(res, 200, OK);
      return;
    }

    if (await backlogFull()) {
      stats.overloaded++;
      reply(res, 503, '{"message":"Navbat to‘lgan, keyinroq qayta yuboring"}');
      return;
    }

    const event = normalized.event;
    let photoPath: string | null = null;

    if (event.picture) stats.withPicture++;
    else if (event.pictureURL) stats.withPictureUrl++;
    else {
      stats.withoutPicture++;
      const last = noPictureWarnedAt.get(terminal.id) ?? 0;
      if (Date.now() - last > 600_000) {
        noPictureWarnedAt.set(terminal.id, Date.now());
        log(
          'warn',
          `Terminal ${terminal.id}: event rasmsiz keldi (serial ${event.serialNo}, ${event.eventAt}). ` +
            `So‘rov tarkibi: ${describeParts(contentType, body)}`,
        );
      }
    }

    if (runtime.savePictures && event.picture) {
      try {
        photoPath = await photos.save(
          terminal.id,
          event.serialNo,
          event.eventAt,
          event.picture,
        );
      } catch (error: unknown) {
        // Rasm yozilmasa ham event yo‘qolmaydi: pictureURL orqali keyin yuklanadi.
        log(
          'warn',
          `Terminal ${terminal.id}: rasm saqlanmadi: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    const message: PushStreamEvent = {
      t: terminal.id,
      s: terminal.schoolId,
      d: terminal.direction,
      p: event.pnfl,
      n: event.serialNo,
      at: event.eventAt,
      mj: event.major,
      mn: event.minor,
      u: event.pictureURL,
      ph: photoPath,
    };

    try {
      await redis.xadd(PUSH_STREAM_KEY, '*', 'd', JSON.stringify(message));
    } catch (error) {
      if (photoPath) await photos.remove(photoPath);
      throw error;
    }
    stats.accepted++;
    reply(res, 200, OK);
  }

  const server = createServer(
    { keepAlive: true, requestTimeout: 30_000, headersTimeout: 15_000 },
    (req, res) => {
      if (inFlight >= config.maxInFlight) {
        stats.overloaded++;
        req.resume();
        reply(res, 503, '{"message":"Server band, keyinroq qayta yuboring"}');
        return;
      }

      inFlight++;
      res.on('close', () => {
        inFlight--;
      });

      handle(req, res).catch((error: unknown) => {
        log(
          'error',
          `Push so‘rovi xatosi: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        // Redis ishlamasa 503: terminal eventni keyinroq qayta yuboradi.
        reply(res, 503, '{"message":"Eventni navbatga saqlab bo‘lmadi"}');
      });
    },
  );

  // 10 000 terminal keep-alive ulanishlari uchun.
  server.keepAliveTimeout = 65_000;
  server.maxHeadersCount = 50;

  return { server, stats, abortedByTerminal };
}
