import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

import { createDigestAuthorization } from '../terminals/helpers/digest-auth';
import { TerminalCryptoService } from '../terminals/terminal-crypto.service';
import type { Terminal } from '../terminals/terminal.entity';

const SNAPSHOT_PATH = '/ISAPI/Streaming/channels/101/picture';
const CACHE_MS = 400;
const MAX_PARALLEL = 50;

interface CacheEntry {
  at: number;
  image: Promise<Buffer>;
}

/**
 * Terminal kamerasidan JPEG kadr. Brauzer RTSP'ni ko‘rsata olmaydi,
 * shuning uchun sahifa kadrlarni ketma-ket so‘raydi (≈3 kadr/s).
 * Bir terminalni bir nechta kishi ko‘rsa ham, terminalga 400 ms da
 * ko‘pi bilan bitta so‘rov ketadi.
 */
@Injectable()
export class LiveSnapshotService {
  private readonly cache = new Map<number, CacheEntry>();
  private active = 0;

  constructor(private readonly crypto: TerminalCryptoService) {}

  snapshot(
    terminal: Terminal & { passwordEncrypted: string },
  ): Promise<Buffer> {
    const cached = this.cache.get(terminal.id);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.image;

    if (this.active >= MAX_PARALLEL) {
      throw new ServiceUnavailableException('Kamera so‘rovlari juda ko‘p');
    }

    const image = this.fetch(terminal);
    this.cache.set(terminal.id, { at: Date.now(), image });
    image.catch(() => this.cache.delete(terminal.id));

    if (this.cache.size > 1000) {
      for (const [id, entry] of this.cache) {
        if (Date.now() - entry.at > 10_000) this.cache.delete(id);
      }
    }
    return image;
  }

  private async fetch(
    terminal: Terminal & { passwordEncrypted: string },
  ): Promise<Buffer> {
    this.active++;
    try {
      const host = terminal.host.includes(':')
        ? `[${terminal.host}]`
        : terminal.host;
      const url = `${terminal.protocol.toLowerCase()}://${host}:${terminal.port}${SNAPSHOT_PATH}`;
      const password = this.crypto.decrypt(terminal.passwordEncrypted);

      const request = (authorization?: string) =>
        axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 5000,
          maxRedirects: 0,
          maxContentLength: 3 * 1024 * 1024,
          proxy: false,
          headers: {
            Accept: 'image/jpeg',
            ...(authorization ? { Authorization: authorization } : {}),
          },
          validateStatus: () => true,
        });

      let response = await request();
      if (response.status === 401) {
        const challenge: unknown = response.headers['www-authenticate'];
        if (typeof challenge !== 'string') {
          throw new BadGatewayException(
            'Terminal Digest ma’lumotini qaytarmadi',
          );
        }
        response = await request(
          createDigestAuthorization(
            challenge,
            terminal.username,
            password,
            'GET',
            SNAPSHOT_PATH,
          ),
        );
      }

      if (response.status !== 200) {
        throw new BadGatewayException(
          response.status === 404
            ? 'Terminal kamera kadrini qo‘llab-quvvatlamaydi'
            : `Kamera so‘rovi HTTP ${response.status} bilan tugadi`,
        );
      }

      const buffer = Buffer.from(response.data);
      if (buffer.length < 100 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        throw new BadGatewayException('Terminal JPEG kadr qaytarmadi');
      }
      return buffer;
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Terminal kamerasiga ulanib bo‘lmadi');
    } finally {
      this.active--;
    }
  }
}
