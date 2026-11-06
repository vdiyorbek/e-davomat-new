import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { randomUUID } from 'node:crypto';
import { Terminal } from './terminal.entity';
import { createDigestAuthorization } from './helpers/digest-auth';

export interface HikvisionDeviceInfo {
  model: string;
  serialNumber: string;
  firmwareVersion: string | null;
}

export interface HikvisionTerminalUser {
  employeeNo: string;
  name: string | null;
}

export interface HikvisionUsersPage {
  users: HikvisionTerminalUser[];
  totalMatches: number;
  nextPosition: number | null;
}

export interface HikvisionCreateUserInput {
  employeeNo: string;
  name: string;
  beginTime: string;
  endTime: string;
}

export interface HikvisionFaceUploadInput {
  employeeNo: string;
  fdId: string;
  jpeg: Buffer;
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

  async getDeviceTime(terminal: Terminal, password: string) {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/System/time';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const request = (authorization?: string) =>
      axios.get<string>(url, {
        responseType: 'text',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          Accept: 'application/xml',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        validateStatus: () => true,
      });

    const requestStartedAt = Date.now();

    let response = await request();

    if (response.status === 401) {
      const challenge = response.headers['www-authenticate'];

      if (typeof challenge !== 'string') {
        throw new Error('Terminal Digest autentifikatsiyasini qaytarmadi');
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

    if (response.status !== 200) {
      throw new Error(
        `Terminal vaqtini olib bo‘lmadi: HTTP ${response.status}`,
      );
    }
    const requestFinishedAt = Date.now();

    const networkRoundTripMs = requestFinishedAt - requestStartedAt;
    const xml = response.data;

    if (
      typeof xml !== 'string' ||
      /<!DOCTYPE|<!ENTITY/i.test(xml) ||
      XMLValidator.validate(xml) !== true
    ) {
      throw new Error('Terminal noto‘g‘ri XML qaytardi');
    }

    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: false,
    });

    const parsed: unknown = parser.parse(xml);

    if (!isRecord(parsed) || !isRecord(parsed.Time)) {
      throw new Error('Time ma’lumotlari topilmadi');
    }

    const time = parsed.Time;

    if (
      typeof time.localTime !== 'string' ||
      typeof time.timeMode !== 'string'
    ) {
      throw new Error('Terminal vaqt formati noto‘g‘ri');
    }

    // Vaqtda UTC offset bo'lsagina aniq
    // vaqt nuqtasiga aylantiramiz.
    const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(time.localTime);

    const parsedMs = hasOffset ? Date.parse(time.localTime) : NaN;

    const deviceTime = Number.isFinite(parsedMs)
      ? new Date(parsedMs).toISOString()
      : null;

    const serverMidpointMs = requestStartedAt + networkRoundTripMs / 2;

    // Faqat UTC offseti aniq bo‘lgan vaqtni solishtiramiz.
    const timeDifferenceSeconds = Number.isFinite(parsedMs)
      ? Math.round((parsedMs - serverMidpointMs) / 1000)
      : null;

    let timeStatus: 'SYNCED' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

    if (timeDifferenceSeconds === null) {
      timeStatus = 'UNKNOWN';
    } else if (Math.abs(timeDifferenceSeconds) <= 5) {
      timeStatus = 'SYNCED';
    } else if (Math.abs(timeDifferenceSeconds) <= 30) {
      timeStatus = 'WARNING';
    } else {
      timeStatus = 'CRITICAL';
    }

    return {
      terminalId: terminal.id,
      timeMode: time.timeMode,
      localTime: time.localTime,
      timeZone: typeof time.timeZone === 'string' ? time.timeZone : null,

      deviceTime: Number.isFinite(parsedMs)
        ? new Date(parsedMs).toISOString()
        : null,

      serverTime: new Date(requestFinishedAt).toISOString(),

      networkRoundTripMs,
      timeDifferenceSeconds,
      timeStatus,
    };
  }

  async syncDeviceTime(terminal: Terminal, password: string) {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/System/time';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    // Bu birinchi versiya faqat UTC+5 va manual
    // rejimdagi terminallar uchun mo‘ljallangan.
    const before = await this.getDeviceTime(terminal, password);

    if (before.timeMode.toLowerCase() !== 'manual') {
      throw new Error(
        'Terminal manual rejimda emas. NTP sozlamalarini o‘zgartirmaymiz.',
      );
    }

    if (
      !before.localTime.endsWith('+05:00') ||
      before.timeZone !== 'CST-5:00:00'
    ) {
      throw new Error('Terminal vaqt zonasi UTC+5 ekanini tasdiqlab bo‘lmadi');
    }

    const formatTashkentTime = (date: Date) => {
      const local = new Date(date.getTime() + 5 * 60 * 60 * 1000);

      return local.toISOString().slice(0, 19) + '+05:00';
    };

    const send = (authorization?: string) => {
      // Vaqtni aynan PUT so‘rovi yuborilayotganda olamiz.
      const localTime = formatTashkentTime(new Date());

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <timeMode>manual</timeMode>
  <localTime>${localTime}</localTime>
  <timeZone>CST-5:00:00</timeZone>
</Time>`;

      return axios.put<string>(url, xml, {
        responseType: 'text',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        validateStatus: () => true,
      });
    };

    let response = await send();

    if (response.status === 401) {
      const challenge = response.headers['www-authenticate'];

      if (typeof challenge !== 'string') {
        throw new Error('Terminal Digest ma’lumotini qaytarmadi');
      }

      const authorization = createDigestAuthorization(
        challenge,
        terminal.username,
        password,
        'PUT',
        path,
      );

      response = await send(authorization);
    }

    if (response.status !== 200) {
      throw new Error(`Vaqt sinxronlanmadi: HTTP ${response.status}`);
    }

    // HTTP 200 yetarli emas: ISAPI javobini tekshiramiz.
    const responseXml = response.data;

    if (
      typeof responseXml !== 'string' ||
      /<!DOCTYPE|<!ENTITY/i.test(responseXml) ||
      XMLValidator.validate(responseXml) !== true
    ) {
      throw new Error('Terminal sinxronlash javobini tekshirib bo‘lmadi');
    }

    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      parseTagValue: true,
      processEntities: false,
    });

    const parsed: unknown = parser.parse(responseXml);

    if (
      !isRecord(parsed) ||
      !isRecord(parsed.ResponseStatus) ||
      Number(parsed.ResponseStatus.statusCode) !== 1
    ) {
      throw new Error('Terminal vaqt o‘zgarishini tasdiqlamadi');
    }

    // Vaqtni qurilmadan qayta o‘qib tekshiramiz.
    const after = await this.getDeviceTime(terminal, password);

    const verified =
      after.timeDifferenceSeconds !== null &&
      Math.abs(after.timeDifferenceSeconds) <= 5;

    return {
      terminalId: terminal.id,
      commandAccepted: true,
      verified,
      before: {
        localTime: before.localTime,
        timeDifferenceSeconds: before.timeDifferenceSeconds,
      },
      after: {
        localTime: after.localTime,
        timeDifferenceSeconds: after.timeDifferenceSeconds,
        timeStatus: after.timeStatus,
      },
    };
  }

  async getRegisteredPersonsCount(
    terminal: Terminal,
    password: string,
  ): Promise<number> {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/AccessControl/UserInfo/Count?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const request = (authorization?: string) =>
      axios.get<unknown>(url, {
        responseType: 'json',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          Accept: 'application/json',
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

    if (response.status !== 200) {
      throw new Error(
        `Foydalanuvchilar sonini olishda HTTP ${response.status}`,
      );
    }

    const data: unknown = response.data;

    if (!isRecord(data) || !isRecord(data.UserInfoCount)) {
      throw new Error('Terminal UserInfoCount ma’lumotini qaytarmadi');
    }

    const count = data.UserInfoCount.userNumber;

    if (
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw new Error('Terminal foydalanuvchilar soni noto‘g‘ri');
    }

    return count;
  }

  async getTerminalUsersPage(
    terminal: Terminal,
    password: string,
    position = 0,
    pageSize = 30,
    searchID = randomUUID(),
  ): Promise<HikvisionUsersPage> {
    if (
      !Number.isSafeInteger(position) ||
      position < 0 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 30
    ) {
      throw new Error('Sahifalash parametrlari noto‘g‘ri');
    }

    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/AccessControl/UserInfo/Search?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const body = JSON.stringify({
      UserInfoSearchCond: {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
      },
    });

    const request = (authorization?: string) =>
      axios.post<unknown>(url, body, {
        responseType: 'json',
        timeout: 25000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        maxBodyLength: 4096,
        proxy: false,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
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
        'POST',
        path,
      );

      response = await request(authorization);
    }

    if (response.status !== 200) {
      throw new Error(`Foydalanuvchilarni olishda HTTP ${response.status}`);
    }

    const data: unknown = response.data;

    if (!isRecord(data) || !isRecord(data.UserInfoSearch)) {
      throw new Error('Terminal UserInfoSearch ma’lumotini qaytarmadi');
    }

    const result = data.UserInfoSearch;

    if (
      typeof result.totalMatches !== 'number' ||
      !Number.isSafeInteger(result.totalMatches) ||
      result.totalMatches < 0 ||
      typeof result.numOfMatches !== 'number' ||
      !Number.isSafeInteger(result.numOfMatches) ||
      result.numOfMatches < 0
    ) {
      throw new Error('Terminal foydalanuvchilar soni noto‘g‘ri');
    }

    const rawUsers: unknown = result.UserInfo ?? [];

    const items = Array.isArray(rawUsers) ? rawUsers : [rawUsers];

    if (items.length !== result.numOfMatches || items.length > pageSize) {
      throw new Error('Terminal qaytargan foydalanuvchilar soni mos emas');
    }

    const users: HikvisionTerminalUser[] = items.map((item: unknown) => {
      if (
        !isRecord(item) ||
        (typeof item.employeeNo !== 'string' &&
          typeof item.employeeNo !== 'number')
      ) {
        throw new Error('Terminal employeeNo maydonini noto‘g‘ri qaytardi');
      }

      const employeeNo = String(item.employeeNo);

      if (!employeeNo || employeeNo.length > 64) {
        throw new Error('EmployeeNo qiymati noto‘g‘ri');
      }

      return {
        employeeNo,
        name: typeof item.name === 'string' ? item.name : null,
      };
    });

    const next = position + items.length;

    if (items.length === 0 && position < result.totalMatches) {
      throw new Error('Terminal kutilmaganda bo‘sh sahifa qaytardi');
    }

    return {
      users,
      totalMatches: result.totalMatches,
      nextPosition: next < result.totalMatches ? next : null,
    };
  }

  async getAllTerminalUsers(
    terminal: Terminal,
    password: string,
  ): Promise<HikvisionTerminalUser[]> {
    const searchID = randomUUID();
    const pageSize = 30;
    const maxPages = 500;

    const users: HikvisionTerminalUser[] = [];
    const employeeNumbers = new Set<string>();

    let position = 0;
    let expectedTotal: number | null = null;

    const startedAt = Date.now();

    for (let page = 0; page < maxPages; page++) {
      let result: HikvisionUsersPage | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        const pageStartedAt = Date.now();

        try {
          result = await this.getTerminalUsersPage(
            terminal,
            password,
            position,
            pageSize,
            searchID,
          );

          console.log('HIKVISION USER SEARCH:', {
            terminalId: terminal.id,
            page: page + 1,
            position,
            attempt,
            durationMs: Date.now() - pageStartedAt,
            received: result.users.length,
            total: result.totalMatches,
          });

          break;
        } catch (error: unknown) {
          const code = axios.isAxiosError(error) ? (error.code ?? null) : null;

          const retryable =
            code === 'ECONNABORTED' ||
            code === 'ETIMEDOUT' ||
            code === 'ECONNRESET';

          console.warn('HIKVISION USER SEARCH ERROR:', {
            terminalId: terminal.id,
            page: page + 1,
            position,
            attempt,
            durationMs: Date.now() - pageStartedAt,
            code,
            message: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!retryable || attempt === 2) {
            throw error;
          }

          // Vaqtinchalik tarmoq xatosidan keyin
          // terminalga kichik tanaffus beramiz.
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1000);
          });
        }
      }

      if (!result) {
        throw new Error('Terminal foydalanuvchilar sahifasini qaytarmadi');
      }

      if (expectedTotal === null) {
        expectedTotal = result.totalMatches;
      }

      if (result.totalMatches !== expectedTotal) {
        throw new Error('Qidiruv davomida terminaldagi yozuvlar soni o‘zgardi');
      }

      for (const item of result.users) {
        if (employeeNumbers.has(item.employeeNo)) {
          throw new Error('Terminal takroriy employeeNo qaytardi');
        }

        employeeNumbers.add(item.employeeNo);
        users.push(item);
      }

      if (result.nextPosition === null) {
        if (users.length !== expectedTotal) {
          throw new Error('Terminal foydalanuvchilari to‘liq olinmadi');
        }

        console.log('HIKVISION USER SEARCH COMPLETED:', {
          terminalId: terminal.id,
          totalUsers: users.length,
          pagesRead: page + 1,
          durationMs: Date.now() - startedAt,
        });

        return users;
      }

      if (result.nextPosition <= position) {
        throw new Error('Terminal sahifalash jarayonida siljish bo‘lmadi');
      }

      position = result.nextPosition;
    }

    throw new Error('Terminal foydalanuvchilari sahifalar chegarasidan oshdi');
  }

  async getUserCapacity(terminal: Terminal, password: string) {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/AccessControl/UserInfo/capabilities?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const request = (authorization?: string) =>
      axios.get<unknown>(url, {
        responseType: 'json',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          Accept: 'application/json',
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

    if (response.status !== 200) {
      throw new Error(`Sig‘imni aniqlashda HTTP ${response.status}`);
    }

    const data: unknown = response.data;

    if (!isRecord(data)) {
      throw new Error('Terminal JSON obyekt qaytarmadi');
    }

    const rootKeys = Object.keys(data);

    const userInfo = data.UserInfo;
    const userInfoCap = data.UserInfoCap;

    const root = isRecord(userInfo)
      ? userInfo
      : isRecord(userInfoCap)
        ? userInfoCap
        : null;

    if (!root) {
      throw new Error(
        `Kutilmagan capability tuzilmasi. Root keys: ${rootKeys.join(', ')}`,
      );
    }

    console.log('Hikvision capability diagnostic:', {
      rootKeys,
      capabilityKeys: Object.keys(root),
    });

    const cap = root;
    const value = cap.maxRecordNum;

    const maxPersons =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value)
          ? Number(value)
          : null;

    return {
      terminalId: terminal.id,
      maxPersons:
        maxPersons !== null &&
        Number.isSafeInteger(maxPersons) &&
        maxPersons > 0
          ? maxPersons
          : null,
      capacityKnown:
        maxPersons !== null &&
        Number.isSafeInteger(maxPersons) &&
        maxPersons > 0,
    };
  }

  async getFaceRecordsCount(terminal: Terminal, password: string) {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/Intelligent/FDLib/Count?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const request = (authorization?: string) =>
      axios.get<unknown>(url, {
        responseType: 'json',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          Accept: 'application/json',
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

    if (response.status !== 200) {
      throw new Error(`Yuz yozuvlarini sanashda HTTP ${response.status}`);
    }

    const data: unknown = response.data;

    if (!isRecord(data)) {
      throw new Error('Terminal noto‘g‘ri JSON qaytardi');
    }

    if (Number(data.statusCode) !== 1) {
      throw new Error('Terminal yuz bazasi so‘rovini muvaffaqiyatli bajarmadi');
    }

    const rawRecords = data.FDRecordDataInfo;

    const records: unknown[] = Array.isArray(rawRecords)
      ? rawRecords
      : isRecord(rawRecords)
        ? [rawRecords]
        : [];

    let total = 0;
    let valid = true;

    const libraries: Array<{
      FDID: string | null;
      faceLibType: string | null;
      faceRecords: number | null;
    }> = [];

    for (const item of records) {
      if (!isRecord(item)) {
        valid = false;
        continue;
      }

      const rawCount = item.recordDataNumber;

      const count =
        typeof rawCount === 'number'
          ? rawCount
          : typeof rawCount === 'string' && /^\d+$/.test(rawCount)
            ? Number(rawCount)
            : null;

      const safeCount =
        count !== null && Number.isSafeInteger(count) && count >= 0
          ? count
          : null;

      if (safeCount === null) {
        valid = false;
      } else {
        total += safeCount;
      }

      libraries.push({
        FDID: typeof item.FDID === 'string' ? item.FDID : null,
        faceLibType:
          typeof item.faceLibType === 'string' ? item.faceLibType : null,
        faceRecords: safeCount,
      });
    }

    // Bo‘sh yoki tushunarsiz javobni 0 deb
    // qabul qilmaymiz.
    const faceRecords =
      records.length > 0 && valid && Number.isSafeInteger(total) ? total : null;

    return {
      terminalId: terminal.id,
      supported: true,
      faceRecords,
      libraries,
      responseFields: Object.keys(data),
      recordFields:
        records.length > 0 && isRecord(records[0])
          ? Object.keys(records[0])
          : [],
    };
  }

  async createTerminalUser(
    terminal: Terminal,
    password: string,
    input: HikvisionCreateUserInput,
  ): Promise<{
    success: boolean;
    employeeNo: string;
  }> {
    if (!/^\d{14}$/.test(input.employeeNo)) {
      throw new Error(
        'Shaxs identifikatori 14 ta raqamdan iborat bo‘lishi kerak',
      );
    }

    const name = input.name.trim();

    if (!name || name.length > 96) {
      throw new Error('F.I.Sh. noto‘g‘ri');
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

    if (
      !datePattern.test(input.beginTime) ||
      !datePattern.test(input.endTime) ||
      !Number.isFinite(Date.parse(input.beginTime + '+05:00')) ||
      !Number.isFinite(Date.parse(input.endTime + '+05:00')) ||
      input.beginTime >= input.endTime
    ) {
      throw new Error('Shaxsning amal qilish muddati noto‘g‘ri');
    }

    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/AccessControl/UserInfo/Record?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const body = JSON.stringify({
      UserInfo: {
        employeeNo: input.employeeNo,
        name,
        userType: 'normal',
        Valid: {
          enable: true,
          beginTime: input.beginTime,
          endTime: input.endTime,
          timeType: 'local',
        },
      },
    });

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const request = (authorization?: string) =>
        axios.post<unknown>(url, body, {
          responseType: 'json',
          timeout: 15000,
          signal: controller.signal,
          maxRedirects: 0,
          maxContentLength: 256 * 1024,
          maxBodyLength: 4096,
          proxy: false,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
          },
          validateStatus: () => true,
        });

      let response = await request();

      if (response.status === 401) {
        const challenge: unknown = response.headers['www-authenticate'];

        if (typeof challenge !== 'string') {
          throw new Error('Terminal Digest autentifikatsiyasini qaytarmadi');
        }

        const authorization = createDigestAuthorization(
          challenge,
          terminal.username,
          password,
          'POST',
          path,
        );

        response = await request(authorization);
      }

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Shaxsni yaratishda HTTP ${response.status}`);
      }

      const data: unknown = response.data;

      if (!isRecord(data) || Number(data.statusCode) !== 1) {
        throw new Error('Hikvision shaxs yaratilganini tasdiqlamadi');
      }

      return {
        success: true,
        employeeNo: input.employeeNo,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error('Terminal 15 soniya ichida javob bermadi');
      }

      if (axios.isAxiosError(error)) {
        throw new Error(
          'Terminal bilan aloqa xatosi. Yozuv yaratilgan bo‘lishi mumkin; qayta urinishdan oldin mavjudligini tekshiring.',
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async uploadTerminalFace(
    terminal: Terminal,
    password: string,
    input: HikvisionFaceUploadInput,
  ): Promise<{ accepted: boolean }> {
    if (!/^\d{14}$/.test(input.employeeNo)) {
      throw new Error('EmployeeNo noto‘g‘ri');
    }

    if (!/^[A-Za-z0-9_-]{1,63}$/.test(input.fdId)) {
      throw new Error('FDID noto‘g‘ri');
    }

    if (
      !Buffer.isBuffer(input.jpeg) ||
      input.jpeg.length < 4 ||
      input.jpeg.length >= 200 * 1024 ||
      input.jpeg[0] !== 0xff ||
      input.jpeg[1] !== 0xd8 ||
      input.jpeg[input.jpeg.length - 2] !== 0xff ||
      input.jpeg[input.jpeg.length - 1] !== 0xd9
    ) {
      throw new Error('JPEG fayl yoki hajmi noto‘g‘ri');
    }

    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const boundary = `----Hikvision${randomUUID().replace(/-/g, '')}`;
    const crlf = '\r\n';

    const metadata = JSON.stringify({
      faceLibType: 'blackFD',
      FDID: input.fdId,
      FPID: input.employeeNo,
    });

    const header = Buffer.from(
      `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="FaceDataRecord"${crlf}` +
        `Content-Type: application/json${crlf}${crlf}` +
        metadata +
        crlf +
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="FaceImage"; filename="face.jpg"${crlf}` +
        `Content-Type: image/jpeg${crlf}${crlf}`,
      'utf8',
    );

    const footer = Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8');

    const body = Buffer.concat([header, input.jpeg, footer]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const request = (authorization?: string) =>
        axios.post<unknown>(url, body, {
          responseType: 'json',
          timeout: 20000,
          signal: controller.signal,
          maxRedirects: 0,
          maxContentLength: 256 * 1024,
          maxBodyLength: 512 * 1024,
          proxy: false,
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(body.length),
            Accept: 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
          },
          validateStatus: () => true,
        });

      let response = await request();

      if (response.status === 401) {
        const challenge: unknown = response.headers['www-authenticate'];

        if (typeof challenge !== 'string') {
          throw new Error('Terminal Digest challenge qaytarmadi');
        }

        const authorization = createDigestAuthorization(
          challenge,
          terminal.username,
          password,
          'POST',
          path,
        );

        response = await request(authorization);
      }

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Yuz rasmini yuklashda HTTP ${response.status}`);
      }

      const data: unknown = response.data;

      if (!isRecord(data) || Number(data.statusCode) !== 1) {
        throw new Error('Terminal yuz rasmini qabul qilganini tasdiqlamadi');
      }

      return { accepted: true };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error(
          'Terminal javobi kechikdi. Yozuv saqlangan bo‘lishi mumkin',
        );
      }

      if (axios.isAxiosError(error)) {
        throw new Error(
          'Yuz rasmini yuklashda aloqa xatosi. Qayta yuborishdan oldin yozuvni tekshiring',
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async getFaceRecognizeMode(terminal: Terminal, password: string) {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const path = '/ISAPI/AccessControl/FaceRecognizeMode?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const request = (authorization?: string) =>
      axios.get<unknown>(url, {
        responseType: 'text',
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: {
          Accept: 'application/json, application/xml',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        validateStatus: () => true,
      });

    let response = await request();

    if (response.status === 401) {
      const challenge: unknown = response.headers['www-authenticate'];

      if (typeof challenge !== 'string') {
        throw new Error('Terminal Digest autentifikatsiyasini qaytarmadi');
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

    if (response.status !== 200) {
      return {
        terminalId: terminal.id,
        supported: false,
        httpStatus: response.status,
        mode: null,
        responseFields: [],
      };
    }

    const raw = response.data;

    if (typeof raw !== 'string') {
      throw new Error('Terminal javobi noto‘g‘ri');
    }

    if (raw.length > 256 * 1024) {
      throw new Error('Terminal javobi juda katta');
    }

    let parsed: unknown;

    if (raw.trimStart().startsWith('<')) {
      if (
        /<!DOCTYPE|<!ENTITY/i.test(raw) ||
        XMLValidator.validate(raw) !== true
      ) {
        throw new Error('Terminal noto‘g‘ri XML qaytardi');
      }

      parsed = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
        processEntities: false,
      }).parse(raw);
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Terminal noto‘g‘ri JSON qaytardi');
      }
    }

    if (!isRecord(parsed)) {
      throw new Error('Terminal javobi obyekt emas');
    }

    const recognized = parsed.FaceRecognizeMode;

    const settings = isRecord(recognized) ? recognized : parsed;

    return {
      terminalId: terminal.id,
      supported: true,
      mode: typeof settings.mode === 'string' ? settings.mode : null,
      responseFields: Object.keys(settings),
    };
  }

  async searchTerminalFace(
    terminal: Terminal,
    password: string,
    employeeNo: string,
    fdId = '1',
  ): Promise<{
    checked: boolean;
    exists: boolean | null;
    status: 'FACE_EXISTS' | 'MISSING_FACE' | 'UNKNOWN';
    fdId: string;
    responseStatus: string | null;
    totalMatches: number | null;
    responseFields: string[];
    matchFields: string[];
  }> {
    if (!/^\d{14}$/.test(employeeNo)) {
      throw new Error('EmployeeNo noto‘g‘ri');
    }

    if (!/^\d{1,10}$/.test(fdId)) {
      throw new Error('FDID noto‘g‘ri');
    }

    const path = '/ISAPI/Intelligent/FDLib/FDSearch?format=json';

    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const searchID = randomUUID();

    const body = JSON.stringify({
      searchID,
      searchResultPosition: 0,
      maxResults: 10,
      faceLibType: 'blackFD',
      FDID: fdId,
      FPID: employeeNo,
    });

    const request = (authorization?: string) =>
      axios.post<unknown>(url, body, {
        timeout: 15000,
        responseType: 'json',
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        maxBodyLength: 4096,
        proxy: false,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        validateStatus: () => true,
      });

    let response = await request();

    if (response.status === 401) {
      const challenge: unknown = response.headers['www-authenticate'];

      if (typeof challenge !== 'string') {
        throw new Error('Terminal Digest challenge qaytarmadi');
      }

      const authorization = createDigestAuthorization(
        challenge,
        terminal.username,
        password,
        'POST',
        path,
      );

      response = await request(authorization);
    }

    if (response.status !== 200) {
      throw new Error(`FDSearch HTTP ${response.status}`);
    }

    let data: unknown = response.data;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        throw new Error('FDSearch JSON javobi noto‘g‘ri');
      }
    }

    if (!isRecord(data)) {
      throw new Error('FDSearch javobi obyekt emas');
    }

    const result = isRecord(data.FDSearchResult) ? data.FDSearchResult : data;

    const responseFields = Object.keys(result);

    const responseStatus =
      typeof result.responseStatusStrg === 'string'
        ? result.responseStatusStrg
        : null;

    const totalMatches =
      typeof result.totalMatches === 'number'
        ? result.totalMatches
        : typeof result.totalMatches === 'string' &&
            /^\d+$/.test(result.totalMatches)
          ? Number(result.totalMatches)
          : null;

    const matchList = result.MatchList;

    let matches: unknown[] = [];

    if (Array.isArray(matchList)) {
      matches = matchList;
    } else if (isRecord(matchList)) {
      if (Array.isArray(matchList.MatchElement)) {
        matches = matchList.MatchElement;
      } else if (isRecord(matchList.MatchElement)) {
        matches = [matchList.MatchElement];
      }
    }

    const matchFields = [
      ...new Set(matches.filter(isRecord).flatMap((item) => Object.keys(item))),
    ];

    // Faqat aynan shu employeeNo/FPID bo‘yicha
    // aniqlangan yozuvni mavjud deb hisoblaymiz.
    const exactMatch = matches.some((item) => {
      if (!isRecord(item)) return false;

      const recordId = item.FPID ?? item.employeeNo;

      return (
        String(recordId ?? '') === employeeNo &&
        String(item.FDID ?? fdId) === fdId
      );
    });

    const base = {
      fdId,
      responseStatus,
      totalMatches,
      responseFields,
      matchFields,
    };

    if (exactMatch) {
      return {
        ...base,
        checked: true,
        exists: true,
        status: 'FACE_EXISTS',
      };
    }

    // Manfiy natijani faqat qidiruv
    // yakunlanganida qabul qilamiz.
    const normalizedStatus = responseStatus?.trim().toUpperCase();

    const noMatches =
      normalizedStatus === 'NO MATCH' || normalizedStatus === 'NO MATCHES';

    if (noMatches && totalMatches === 0 && matches.length === 0) {
      return {
        ...base,
        checked: true,
        exists: false,
        status: 'MISSING_FACE',
      };
    }

    // Javob formati yoki qidiruv yakuni
    // noaniq bo‘lsa, yuz yo‘q deb hisoblamaymiz.
    return {
      ...base,
      checked: true,
      exists: null,
      status: 'UNKNOWN',
    };
  }
}
