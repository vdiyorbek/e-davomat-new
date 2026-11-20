import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { request } from 'node:http';

import { createPushServer } from './server';

const TOKEN = 'a'.repeat(64);
const HASH = createHash('sha256').update(TOKEN).digest('hex');

const faceEvent = (serialNo: number) =>
  JSON.stringify({
    EventNotificationAlert: {
      eventType: 'AccessControllerEvent',
      dateTime: '2026-11-18T08:00:00+05:00',
      AccessControllerEvent: {
        majorEventType: 5,
        subEventType: 75,
        serialNo,
        employeeNoString: '12345678901234',
        currentVerifyMode: 'face',
      },
    },
  });

describe('Push ingest server', () => {
  let server: Server;
  let stats: { aborted: number };
  let abortedByTerminal: Map<number, number>;
  let url: string;
  const xadd = jest.fn().mockResolvedValue('1-0');
  const xlen = jest.fn().mockResolvedValue(0);
  const markReceived = jest.fn();

  beforeAll(async () => {
    ({ server, stats, abortedByTerminal } = createPushServer({
      config: {
        bodyLimit: 64 * 1024,
        maxInFlight: 100,
        perTerminalRps: 1000,
        maxBacklog: 10,
        savePictures: true,
      },
      registry: {
        find: (hash) =>
          hash === HASH ? { id: 7, schoolId: 3, direction: 'IN' } : undefined,
        markReceived,
      },
      redis: { xadd, xlen } as never,
      photos: { save: jest.fn(), remove: jest.fn() },
      log: () => undefined,
    }));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));
  beforeEach(() => jest.clearAllMocks());

  const post = (path: string, body: string, type = 'application/json') =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': type },
      body,
    });

  it('yuz eventini navbatga ixcham ko‘rinishda yozadi', async () => {
    const response = await post(`/api/hikvision-push/${TOKEN}`, faceEvent(41));

    expect(response.status).toBe(200);
    expect(markReceived).toHaveBeenCalledWith(7);
    expect(xadd).toHaveBeenCalledTimes(1);

    const message = JSON.parse(xadd.mock.calls[0][3] as string) as Record<
      string,
      unknown
    >;
    expect(message).toMatchObject({ t: 7, s: 3, d: 'IN', n: '41', ph: null });
  });

  it('noma’lum token — 401, navbatga yozilmaydi', async () => {
    const response = await post(
      `/api/hikvision-push/${'b'.repeat(64)}`,
      faceEvent(1),
    );
    expect(response.status).toBe(401);
    expect(xadd).not.toHaveBeenCalled();
  });

  it('heartbeat — 200, lekin navbatga yozilmaydi', async () => {
    const response = await post(
      `/api/hikvision-push/${TOKEN}`,
      JSON.stringify({ EventNotificationAlert: { eventType: 'heartBeat' } }),
    );
    expect(response.status).toBe(200);
    expect(xadd).not.toHaveBeenCalled();
  });

  it('hajmi chegaradan katta body — 413', async () => {
    const response = await post(
      `/api/hikvision-push/${TOKEN}`,
      'x'.repeat(70 * 1024),
    );
    expect(response.status).toBe(413);
  });

  it('navbat to‘lsa 503 qaytaradi (terminal keyin qayta yuboradi)', async () => {
    xlen.mockResolvedValueOnce(100);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const response = await post(`/api/hikvision-push/${TOKEN}`, faceEvent(2));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(xadd).not.toHaveBeenCalled();
  });

  it('Redis ishlamasa 503 qaytaradi', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    xadd.mockRejectedValueOnce(new Error('down'));
    const response = await post(`/api/hikvision-push/${TOKEN}`, faceEvent(3));
    expect(response.status).toBe(503);
  });
  it('terminal tanani yubormay uzsa — xato emas, terminal bo‘yicha sanaladi', async () => {
    const before = stats.aborted;
    await new Promise<void>((resolve) => {
      const req = request(
        `${url}/api/hikvision-push/${TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': 500,
          },
        },
        () => undefined,
      );
      req.on('error', () => resolve());
      // Tananing faqat bir qismini yuboramiz va ulanishni uzamiz.
      req.write('0123456789', () => setTimeout(() => req.destroy(), 50));
    });
    for (let i = 0; i < 40 && stats.aborted === before; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(stats.aborted).toBe(before + 1);
    expect(abortedByTerminal.get(7)).toBeGreaterThanOrEqual(1);
    expect(xadd).not.toHaveBeenCalled();
  });
});
