import {
  describeParts,
  normalizePush,
  parsePush,
} from './hikvision-push.parser';

describe('Hikvision HTTP Push Parser', () => {
  const event = {
    EventNotificationAlert: {
      eventType: 'AccessControllerEvent',
      dateTime: '2026-11-18T11:41:23+05:00',
      AccessControllerEvent: {
        majorEventType: 5,
        subEventType: 75,
        serialNo: 406132,
        employeeNoString: '12345678901234',
        currentVerifyMode: 'face',
      },
    },
  };

  it('JSON yuz identifikatsiyasi eventini ajratadi', () => {
    const result = parsePush(
      'application/json',
      Buffer.from(JSON.stringify(event)),
    );

    expect(result).not.toBeNull();
    expect(result?.eventType).toBe('AccessControllerEvent');
    expect(result?.major).toBe(5);
    expect(result?.minor).toBe(75);
    expect(result?.serialNo).toBe('406132');
    expect(result?.pnfl).toBe('12345678901234');
    expect(result?.verifyMode).toBe('face');
  });

  it('multipart JSON eventini ajratadi', () => {
    const boundary = 'MIME_boundary';

    const body = Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="event"\r\n' +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(event) +
        `\r\n--${boundary}--\r\n`,
    );

    const result = parsePush(`multipart/form-data; boundary=${boundary}`, body);

    expect(result?.major).toBe(5);
    expect(result?.minor).toBe(75);
    expect(result?.pnfl).toBe('12345678901234');
  });

  it('XML eventini ajratadi', () => {
    const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <dateTime>2026-11-18T11:41:23+05:00</dateTime>
        <AccessControllerEvent>
          <majorEventType>5</majorEventType>
          <subEventType>75</subEventType>
          <serialNo>406132</serialNo>
          <employeeNoString>12345678901234</employeeNoString>
          <currentVerifyMode>face</currentVerifyMode>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;

    const result = parsePush('application/xml', Buffer.from(xml));

    expect(result?.major).toBe(5);
    expect(result?.minor).toBe(75);
    expect(result?.verifyMode).toBe('face');
  });

  it('boshqa access-control eventini ajratadi', () => {
    const other = structuredClone(event);

    other.EventNotificationAlert.AccessControllerEvent.subEventType = 22;

    const result = parsePush(
      'application/json',
      Buffer.from(JSON.stringify(other)),
    );

    expect(result?.minor).toBe(22);
  });

  it('noto‘g‘ri JSON uchun null qaytaradi', () => {
    const result = parsePush('application/json', Buffer.from('{invalid json'));

    expect(result).toBeNull();
  });
});

describe('Push rasm va normalizatsiya', () => {
  const event = {
    EventNotificationAlert: {
      eventType: 'AccessControllerEvent',
      dateTime: '2026-11-18T08:01:02+05:00',
      AccessControllerEvent: {
        majorEventType: 5,
        subEventType: 75,
        serialNo: 77,
        employeeNoString: '12345678901234',
        currentVerifyMode: 'face',
      },
    },
  };
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(500, 7),
    Buffer.from([0xff, 0xd9]),
  ]);

  function multipart(picture: Buffer, pictureType = 'image/jpeg') {
    const b = 'MIME_boundary';
    return {
      type: `multipart/form-data; boundary=${b}`,
      body: Buffer.concat([
        Buffer.from(
          `--${b}\r\nContent-Disposition: form-data; name="event_log"\r\n` +
            `Content-Type: application/json\r\n\r\n${JSON.stringify(event)}\r\n` +
            `--${b}\r\nContent-Disposition: form-data; name="Picture"; filename="Picture.jpg"\r\n` +
            `Content-Type: ${pictureType}\r\n\r\n`,
        ),
        picture,
        Buffer.from(`\r\n--${b}--\r\n`),
      ]),
    };
  }

  it('multipart ichidagi JPEG rasmni aniq ajratadi', () => {
    const { type, body } = multipart(jpeg);
    const result = normalizePush(type, body);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.picture?.equals(jpeg)).toBe(true);
    expect(result.event.eventAt).toBe('2026-11-18T03:01:02.000Z');
    expect(result.event.serialNo).toBe('77');
  });

  it('octet-stream sifatida kelgan JPEG rasmni ham oladi', () => {
    const { type, body } = multipart(jpeg, 'application/octet-stream');
    const result = normalizePush(type, body);
    expect(result.ok && result.event.picture?.equals(jpeg)).toBe(true);
  });

  it('diagnostika qismlar sarlavhasi va hajmini ko‘rsatadi', () => {
    const { type, body } = multipart(jpeg);
    const text = describeParts(type, body);
    expect(text).toContain('name="Picture"');
    expect(text).toContain(`${jpeg.length + 2} B, JPEG`);
    expect(text).not.toContain('12345678901234');
  });

  it('JPEG bo‘lmagan qismni rasm deb olmaydi', () => {
    const { type, body } = multipart(Buffer.alloc(500, 1));
    const result = normalizePush(type, body);
    expect(result.ok && result.event.picture).toBeNull();
  });

  it('heartbeat va boshqa eventlarni rad etadi', () => {
    const heartbeat = { EventNotificationAlert: { eventType: 'heartBeat' } };
    expect(
      normalizePush('application/json', Buffer.from(JSON.stringify(heartbeat))),
    ).toEqual({ ok: false, reason: 'not-face-event' });
  });

  it('kelajakdagi vaqtni rad etadi', () => {
    const future = structuredClone(event);
    future.EventNotificationAlert.dateTime = '2099-01-01T00:00:00+05:00';
    expect(
      normalizePush('application/json', Buffer.from(JSON.stringify(future))),
    ).toEqual({ ok: false, reason: 'time' });
  });
});
