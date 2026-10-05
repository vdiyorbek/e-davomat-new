import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { Terminal } from './terminal.entity';
import { createDigestAuthorization } from './helpers/digest-auth';

export interface HikvisionDeviceInfo {
  model: string;
  serialNumber: string;
  firmwareVersion: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class HikvisionService {
  async getDeviceInfo(
    terminal: Terminal,
    password: string,
  ): Promise<HikvisionDeviceInfo> {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/System/deviceInfo';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const request = (authorization?: string) =>
        axios.get<string>(url, {
          responseType: 'text',
          timeout: 10000,
          signal: controller.signal,
          maxRedirects: 0,
          maxContentLength: 256 * 1024,
          proxy: false,
          headers: {
            Accept: 'application/xml',
            ...(authorization ? { Authorization: authorization } : {}),
          },
          validateStatus: () => true,
        });

      let response = await request();

      if (response.status === 401) {
        const challenge: unknown = response.headers['www-authenticate'];

        if (typeof challenge !== 'string') {
          throw new Error('Terminal Digest ma’lumotini qaytarmadi');
        }

        const authorization = createDigestAuthorization(
          challenge,
          terminal.username,
          password,
          'GET',
          path,
        );

        response = await request(authorization);
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Terminal login-parolni rad etdi yoki hisobga ISAPI ruxsati berilmagan',
        );
      }

      if (response.status !== 200) {
        throw new Error(`Terminal HTTP ${response.status} javobini qaytardi`);
      }

      const xml = response.data;

      if (
        typeof xml !== 'string' ||
        /<!DOCTYPE|<!ENTITY/i.test(xml) ||
        XMLValidator.validate(xml) !== true
      ) {
        throw new Error('Terminaldan noto‘g‘ri XML javob olindi');
      }

      const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
        trimValues: true,
        processEntities: false,
      });

      const parsed: unknown = parser.parse(xml);

      if (!isRecord(parsed) || !isRecord(parsed.DeviceInfo)) {
        throw new Error('Javobda DeviceInfo mavjud emas');
      }

      const info = parsed.DeviceInfo;
      const model = info.model;
      const serialNumber = info.serialNumber;

      if (
        typeof model !== 'string' ||
        !model ||
        model.length > 100 ||
        typeof serialNumber !== 'string' ||
        !serialNumber ||
        serialNumber.length > 150
      ) {
        throw new Error('Terminal modeli yoki seriya raqami noto‘g‘ri');
      }

      return {
        model,
        serialNumber,
        firmwareVersion:
          typeof info.firmwareVersion === 'string'
            ? info.firmwareVersion
            : null,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error('Terminal 10 soniya ichida javob bermadi');
      }

      if (axios.isAxiosError(error)) {
        // Axios xatosining config/header qismlarini tashqariga bermaymiz.
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new Error('Terminal javobini kutish vaqti tugadi');
        }

        throw new Error(
          'Terminalga ulanib bo‘lmadi. IP, port, VPN va HTTPS bo‘lsa sertifikatni tekshiring',
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
