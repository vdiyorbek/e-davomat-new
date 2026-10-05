import { Injectable } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';

import { Terminal } from './terminal.entity';
import { createDigestAuthorization } from './helpers/digest-auth';

@Injectable()
export class HikvisionPhotoService {
  async download(
    terminal: Terminal,
    password: string,
    sourceUrl: string,
  ): Promise<Buffer> {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const terminalOrigin = new URL(
      `${terminal.protocol.toLowerCase()}://${host}:${terminal.port}`,
    );

    let pictureUrl: URL;

    try {
      pictureUrl = new URL(sourceUrl);
    } catch {
      throw new Error('Eventdagi rasm manzili noto‘g‘ri');
    }

    // Terminal parolini boshqa manzilga yubormaymiz.
    if (
      pictureUrl.origin !== terminalOrigin.origin ||
      pictureUrl.username ||
      pictureUrl.password ||
      pictureUrl.hash ||
      !pictureUrl.pathname.startsWith('/LOCALS/pic/')
    ) {
      throw new Error(
        'Rasm manzili terminal manziliga yoki ruxsat etilgan yo‘lga mos emas',
      );
    }

    const uri = pictureUrl.pathname + pictureUrl.search;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const request = (authorization?: string) =>
        axios.get<ArrayBuffer>(pictureUrl.toString(), {
          responseType: 'arraybuffer',
          timeout: 10000,
          signal: controller.signal,
          maxRedirects: 0,
          maxContentLength: 5 * 1024 * 1024,
          proxy: false,
          headers: {
            Accept: 'image/jpeg,image/png,image/webp',
            ...(authorization
              ? { Authorization: authorization }
              : {}),
          },
          validateStatus: () => true,
        });

      let response = await request();

      if (response.status === 401) {
        const challenge: unknown =
          response.headers['www-authenticate'];

        if (typeof challenge !== 'string') {
          throw new Error('Terminal Digest ma’lumotini qaytarmadi');
        }

        const authorization = createDigestAuthorization(
          challenge,
          terminal.username,
          password,
          'GET',
          uri,
        );

        response = await request(authorization);
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Terminal rasmni olishga ruxsat bermadi');
      }

      if (response.status === 404) {
        throw new Error('Rasm terminalda topilmadi');
      }

      if (response.status !== 200) {
        throw new Error(
          `Rasm so‘rovi HTTP ${response.status} bilan tugadi`,
        );
      }

      const buffer = Buffer.from(response.data);

      if (buffer.length === 0) {
        throw new Error('Terminal bo‘sh rasm qaytardi');
      }

      try {
        const image = sharp(buffer, {
          limitInputPixels: 25_000_000,
          failOn: 'warning',
        });

        const metadata = await image.metadata();

        if (
          !metadata.format ||
          !['jpeg', 'png', 'webp'].includes(metadata.format) ||
          (metadata.pages ?? 1) > 1
        ) {
          throw new Error('Rasm formati qo‘llab-quvvatlanmaydi');
        }

        // Saqlanadigan faylni tekshirilgan JPEG formatiga keltiramiz.
        return await image
          .rotate()
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch {
        throw new Error(
          'Terminal javobi yaroqli JPEG, PNG yoki WebP rasm emas',
        );
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error('Rasmni olish vaqti tugadi');
      }

      if (axios.isAxiosError(error)) {
        throw new Error(
          'Rasmni olib bo‘lmadi: tarmoq xatosi yoki javob hajmi chegaradan oshgan',
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}