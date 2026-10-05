import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class TerminalCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const encodedKey = config
      .getOrThrow<string>('TERMINAL_ENCRYPTION_KEY')
      .trim();

    const decodedKey = Buffer.from(encodedKey, 'base64');

    if (
      decodedKey.length !== 32 ||
      decodedKey.toString('base64') !== encodedKey
    ) {
      throw new Error(
        'TERMINAL_ENCRYPTION_KEY Base64 formatidagi 32 baytli kalit bo‘lishi kerak',
      );
    }

    this.key = decodedKey;
  }

  encrypt(password: string): string {
    if (!password) {
      throw new Error('Terminal paroli bo‘sh bo‘lishi mumkin emas');
    }

    // Har bir shifrlash uchun yangi tasodifiy IV.
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(password, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(value: string): string {
    try {
      const parts = value.split(':');

      if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Shifrlangan qiymat formati noto‘g‘ri');
      }

      const [, ivText, tagText, encryptedText] = parts;

      const iv = Buffer.from(ivText, 'base64');
      const authTag = Buffer.from(tagText, 'base64');
      const encrypted = Buffer.from(encryptedText, 'base64');

      if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
        throw new Error('Shifrlangan qiymat tarkibi noto‘g‘ri');
      }

      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);

      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Xatoga parol yoki shifrlangan qiymatni qo‘shmaymiz.
      throw new Error('Terminal parolini ochib bo‘lmadi');
    }
  }
}
