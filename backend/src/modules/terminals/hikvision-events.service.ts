import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import axios from 'axios';
import { isISO8601 } from 'class-validator';

import { Terminal } from './terminal.entity';
import { createDigestAuthorization } from './helpers/digest-auth';

import type {
  HikvisionEvent,
  HikvisionEventsPage,
} from './interfaces/hikvision-event.interface';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isEvent(value: unknown): value is HikvisionEvent {
  if (!isRecord(value)) return false;

  const validSerial =
    isNonNegativeInteger(value.serialNo) ||
    (typeof value.serialNo === 'string' &&
      /^\d{1,20}$/.test(value.serialNo) &&
      BigInt(value.serialNo) <= 18446744073709551615n);

  const validTime =
    typeof value.time === 'string' &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.time) &&
    isISO8601(value.time, {
      strict: true,
      strictSeparator: true,
    }) &&
    Number.isFinite(Date.parse(value.time));

  const optionalStrings = [
    'employeeNoString',
    'currentVerifyMode',
    'pictureURL',
  ];

  return (
    isNonNegativeInteger(value.major) &&
    isNonNegativeInteger(value.minor) &&
    validSerial &&
    validTime &&
    optionalStrings.every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    )
  );
}

@Injectable()
export class HikvisionEventsService {
  async *readEvents(
    terminal: Terminal,
    password: string,
    startTime: string,
    endTime: string,
  ): AsyncGenerator<HikvisionEvent[]> {
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      startMs >= endMs
    ) {
      throw new Error('Event qidiruv vaqt oralig‘i noto‘g‘ri');
    }

    if (endMs - startMs > 24 * 60 * 60 * 1000) {
      throw new Error('Bitta event qidiruvi 24 soatdan oshmasligi kerak');
    }

    const searchID = randomUUID();
    const pageSize = 100;

    let position = 0;

    // Terminal noto‘g‘ri MORE qaytarsa, cheksiz aylanmaymiz.
    const maxPages = 1000;
    const seenPages = new Set<string>();

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const page = await this.fetchPage(terminal, password, {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
        major: 5,
        minor: 75,
        startTime,
        endTime,
        picEnable: true,
      });

      if (page.events.length === 0) {
        if (page.hasMore) {
          throw new Error(
            'Terminal MORE qaytardi, lekin eventlar ro‘yxati bo‘sh',
          );
        }

        return;
      }

      // Serial raqamlari ketma-ket kelishiga tayanmaymiz.
      const fingerprint = JSON.stringify(
        page.events
          .map(
            (event) =>
              `${event.serialNo}|${event.time}|${event.major}|${event.minor}`,
          )
          .sort(),
      );

      if (seenPages.has(fingerprint)) {
        throw new Error('Terminal bir xil event sahifasini takroran qaytardi');
      }

      seenPages.add(fingerprint);

      yield page.events;

      // Filtrdan o‘tkazilganlar soniga emas,
      // terminal qaytargan eventlar soniga siljitamiz.
      position += page.events.length;

      if (!page.hasMore) {
        return;
      }
    }

    throw new Error(
      'Event sahifalari chegarasiga yetildi. Vaqt oralig‘ini qisqartiring',
    );
  }

  private async fetchPage(
    terminal: Terminal,
    password: string,
    condition: {
      searchID: string;
      searchResultPosition: number;
      maxResults: number;
      major: number;
      minor: number;
      startTime: string;
      endTime: string;
      picEnable: boolean;
    },
  ): Promise<HikvisionEventsPage> {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;

    // Digest hisobida query qismi ham bo‘lishi kerak.
    const path = '/ISAPI/AccessControl/AcsEvent?format=json';

    const url =
      `${terminal.protocol.toLowerCase()}://` +
      `${host}:${terminal.port}${path}`;

    const body = JSON.stringify({
      AcsEventCond: condition,
    });

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 20000);

    try {
      const request = (authorization?: string) =>
        axios.post<string>(url, body, {
          responseType: 'text',
          timeout: 20000,
          signal: controller.signal,
          maxRedirects: 0,
          maxContentLength: 2 * 1024 * 1024,
          maxBodyLength: 16 * 1024,
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

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Terminal login-parolni yoki eventlarni olish ruxsatini rad etdi',
        );
      }

      if (response.status !== 200) {
        throw new Error(`Event so‘rovi HTTP ${response.status} bilan tugadi`);
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(response.data);
      } catch {
        throw new Error('Terminal noto‘g‘ri JSON qaytardi');
      }

      if (!isRecord(parsed) || !isRecord(parsed.AcsEvent)) {
        throw new Error('Terminal javobida AcsEvent mavjud emas');
      }

      const result = parsed.AcsEvent;

      if (result.searchID !== condition.searchID) {
        throw new Error('Terminal boshqa qidiruv identifikatorini qaytardi');
      }

      const status = result.responseStatusStrg;

      if (status !== 'OK' && status !== 'MORE' && status !== 'NO MATCH') {
        throw new Error('Terminal qidiruv holati noma’lum');
      }

      if (
        !isNonNegativeInteger(result.numOfMatches) ||
        !isNonNegativeInteger(result.totalMatches)
      ) {
        throw new Error('Terminal eventlar sonini noto‘g‘ri qaytardi');
      }

      const list: unknown =
        result.InfoList === undefined && result.numOfMatches === 0
          ? []
          : result.InfoList;

      if (
        !Array.isArray(list) ||
        list.length !== result.numOfMatches ||
        list.length > condition.maxResults
      ) {
        throw new Error('Terminal eventlar ro‘yxati va soni mos emas');
      }

      const events: HikvisionEvent[] = [];

      for (const item of list) {
        if (!isEvent(item)) {
          throw new Error('Terminal eventining formati noto‘g‘ri');
        }

        events.push(item);
      }

      if (
        status === 'NO MATCH' &&
        (events.length !== 0 || result.totalMatches !== 0)
      ) {
        throw new Error(
          'Terminal NO MATCH natijasi bilan zid ma’lumot qaytardi',
        );
      }

      return {
        events,
        hasMore: status === 'MORE',
        totalMatches: result.totalMatches,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error(
          'Terminal event so‘roviga 20 soniya ichida javob bermadi',
        );
      }

      if (axios.isAxiosError(error)) {
        throw new Error(
          'Eventlarni olib bo‘lmadi. Terminal, VPN va tarmoq ulanishini tekshiring',
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
