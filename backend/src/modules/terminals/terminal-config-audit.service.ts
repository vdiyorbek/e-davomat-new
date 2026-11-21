import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { DataSource, Repository } from 'typeorm';

import { tashkentDate } from '../hikvision-push/hikvision-push.types';
import { createDigestAuthorization } from './helpers/digest-auth';
import { TerminalCryptoService } from './terminal-crypto.service';
import { Terminal } from './terminal.entity';

const CONCURRENCY = 5;

class AuthFailed extends Error {}

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== ''
    ? value
    : typeof value === 'number'
      ? String(value)
      : null;
}

function flag(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

export interface TerminalAuditItem {
  id: number;
  name: string;
  host: string;
  eventSource: string;
  model: string | null;
  firmware: string | null;
  firmwareDate: string | null;
  pictureUrlType: string | null;
  pushTarget: string | null;
  heartbeat: string | null;
  eventMode: string | null;
  uploadCapPic: boolean | null;
  saveCapPic: boolean | null;
  uploadVerificationPic: boolean | null;
  saveVerificationPic: boolean | null;
  saveFacePic: boolean | null;
  todayTotal: number;
  todayInline: number;
  inlinePercent: number | null;
  error: string | null;
}

/**
 * Terminal sozlamalarini solishtirish: model, firmware, rasm sozlamalari, push
 * sozlamasi. Faqat o‘qiydi. Parol noto‘g‘ri bo‘lsa terminalga qayta urinmaydi
 * (Hikvision bir necha xato urinishdan keyin bloklaydi). Push tokeni qaytarilmaydi.
 */
@Injectable()
export class TerminalConfigAuditService {
  private readonly parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
  });

  constructor(
    @InjectRepository(Terminal)
    private readonly terminals: Repository<Terminal>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly crypto: TerminalCryptoService,
  ) {}

  async run() {
    const list = await this.terminals
      .createQueryBuilder('terminal')
      .addSelect('terminal.passwordEncrypted')
      .where('terminal.isActive = 1')
      .andWhere('terminal.archivedAt IS NULL')
      .orderBy('terminal.id', 'ASC')
      .getMany();

    const todayStart = new Date(`${tashkentDate(new Date())}T00:00:00+05:00`);
    const stats = await this.dataSource.query<
      { terminalId: number; total: string; inline: string | null }[]
    >(
      `SELECT terminalId, COUNT(*) AS total, SUM(photoAttempts = 0) AS inline
         FROM attendance_events
        WHERE eventAt >= ? AND photoStatus = 'DOWNLOADED'
        GROUP BY terminalId`,
      [todayStart],
    );
    const byTerminal = new Map(
      stats.map((row) => [
        Number(row.terminalId),
        { total: Number(row.total), inline: Number(row.inline ?? 0) },
      ]),
    );

    const items: TerminalAuditItem[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const terminal = list[cursor++];
        const today = byTerminal.get(terminal.id) ?? { total: 0, inline: 0 };
        items.push(await this.inspect(terminal, today));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    items.sort((a, b) => a.id - b.id);

    // Model + firmware bo‘yicha guruhlar: rasm push bilan kelish ulushi.
    const groups = new Map<
      string,
      { key: string; count: number; total: number; inline: number }
    >();
    for (const item of items) {
      if (item.error && !item.model) continue;
      const key = `${item.model ?? '?'} · ${item.firmware ?? '?'}`;
      const group = groups.get(key) ?? { key, count: 0, total: 0, inline: 0 };
      group.count += 1;
      group.total += item.todayTotal;
      group.inline += item.todayInline;
      groups.set(key, group);
    }

    return {
      generatedAt: new Date().toISOString(),
      items,
      groups: [...groups.values()]
        .map((group) => ({
          key: group.key,
          terminals: group.count,
          events: group.total,
          inlinePercent:
            group.total > 0
              ? Math.round((100 * group.inline) / group.total)
              : null,
        }))
        .sort((a, b) => b.terminals - a.terminals),
    };
  }

  private async inspect(
    terminal: Terminal,
    today: { total: number; inline: number },
  ): Promise<TerminalAuditItem> {
    const item: TerminalAuditItem = {
      id: terminal.id,
      name: terminal.name,
      host: terminal.host,
      eventSource: terminal.eventSource,
      model: null,
      firmware: null,
      firmwareDate: null,
      pictureUrlType: null,
      pushTarget: null,
      heartbeat: null,
      eventMode: null,
      uploadCapPic: null,
      saveCapPic: null,
      uploadVerificationPic: null,
      saveVerificationPic: null,
      saveFacePic: null,
      todayTotal: today.total,
      todayInline: today.inline,
      inlinePercent:
        today.total > 0 ? Math.round((100 * today.inline) / today.total) : null,
      error: null,
    };

    let password: string;
    try {
      password = this.crypto.decrypt(terminal.passwordEncrypted);
    } catch {
      item.error = 'Terminal parolini ochib bo‘lmadi';
      return item;
    }

    try {
      // 1) deviceInfo — parol noto‘g‘ri bo‘lsa shu yerda to‘xtaymiz.
      const info = this.parseXml(
        await this.get(terminal, password, '/ISAPI/System/deviceInfo'),
        'DeviceInfo',
      );
      item.model = text(info?.model);
      item.firmware = text(info?.firmwareVersion);
      item.firmwareDate = text(info?.firmwareReleasedDate);
    } catch (error: unknown) {
      item.error =
        error instanceof AuthFailed
          ? 'Parol noto‘g‘ri (bloklanmasligi uchun qayta urinilmadi)'
          : error instanceof Error
            ? error.message.slice(0, 160)
            : 'Xato';
      return item;
    }

    try {
      const hosts = this.parseXml(
        await this.get(
          terminal,
          password,
          '/ISAPI/Event/notification/httpHosts',
        ),
        'HttpHostNotificationList',
      );
      const entries = hosts?.HttpHostNotification;
      const list: unknown[] = Array.isArray(entries)
        ? (entries as unknown[])
        : entries
          ? [entries]
          : [];
      const http = list.find(
        (entry) => isDict(entry) && entry.protocolType === 'HTTP',
      );
      if (isDict(http)) {
        const ip = text(http.ipAddress) ?? text(http.hostName);
        const port = text(http.portNo);
        item.pushTarget = ip ? `${ip}${port ? `:${port}` : ''}` : null;
        const subscribe = http.SubscribeEvent;
        if (isDict(subscribe)) {
          item.heartbeat = text(subscribe.heartbeat);
          item.eventMode = text(subscribe.eventMode);
          const eventList = subscribe.EventList;
          const event = isDict(eventList) ? first(eventList.Event) : null;
          if (isDict(event)) item.pictureUrlType = text(event.pictureURLType);
        }
      }
    } catch (error: unknown) {
      if (error instanceof AuthFailed) {
        item.error = 'Parol noto‘g‘ri';
        return item;
      }
    }

    try {
      const body = await this.get(
        terminal,
        password,
        '/ISAPI/AccessControl/AcsCfg',
      );
      let cfg: Dict | null = null;
      if (body.trim().startsWith('{')) {
        const json = JSON.parse(body) as unknown;
        cfg = isDict(json) && isDict(json.AcsCfg) ? json.AcsCfg : null;
      } else {
        cfg = this.parseXml(body, 'AcsCfg');
      }
      if (cfg) {
        item.uploadCapPic = flag(cfg.uploadCapPic);
        item.saveCapPic = flag(cfg.saveCapPic);
        item.uploadVerificationPic = flag(cfg.uploadVerificationPic);
        item.saveVerificationPic = flag(cfg.saveVerificationPic);
        item.saveFacePic = flag(cfg.saveFacePic);
      }
    } catch {
      // AcsCfg barcha modellarda bo‘lmasligi mumkin — jadvalda bo‘sh ko‘rinadi.
    }

    return item;
  }

  private parseXml(xml: string, root: string): Dict | null {
    if (
      /<!DOCTYPE|<!ENTITY/i.test(xml) ||
      XMLValidator.validate(xml) !== true
    ) {
      return null;
    }
    const parsed: unknown = this.parser.parse(xml);
    return isDict(parsed) && isDict(parsed[root]) ? parsed[root] : null;
  }

  /** Digest bilan GET; autentifikatsiya rad etilsa AuthFailed (qayta urinmaydi). */
  private async get(
    terminal: Terminal,
    password: string,
    path: string,
  ): Promise<string> {
    const host = terminal.host.includes(':')
      ? `[${terminal.host}]`
      : terminal.host;
    const url = `${terminal.protocol.toLowerCase()}://${host}:${terminal.port}${path}`;
    const request = (authorization?: string) =>
      axios.get<string>(url, {
        responseType: 'text',
        timeout: 10_000,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        proxy: false,
        headers: authorization ? { Authorization: authorization } : {},
        validateStatus: () => true,
      });

    let response = await request();
    if (response.status === 401) {
      const challenge: unknown = response.headers['www-authenticate'];
      if (typeof challenge !== 'string') {
        throw new Error('Terminal Digest autentifikatsiyasini qaytarmadi');
      }
      response = await request(
        createDigestAuthorization(
          challenge,
          terminal.username,
          password,
          'GET',
          path,
        ),
      );
      if (response.status === 401) throw new AuthFailed();
    }
    if (response.status !== 200 || typeof response.data !== 'string') {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.data;
  }
}
