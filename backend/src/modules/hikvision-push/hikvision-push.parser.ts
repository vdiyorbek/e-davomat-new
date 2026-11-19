import { XMLParser } from 'fast-xml-parser';

export type ParsedAccessEvent = {
  eventType: string;
  major: number | null;
  minor: number | null;
  serialNo: string | null;
  time: string | null;
  pnfl: string | null;
  verifyMode: string | null;
  pictureURL: string | null;
  /** Multipart ichidagi yuz rasmi (JPEG). Nusxa emas — body'ning bir qismi. */
  picture: Buffer | null;
};

const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const CRLF = Buffer.from('\r\n');
const HEADER_SEP = Buffer.from('\r\n\r\n');

const xml = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
});
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function str(v: unknown): string | null {
  return typeof v === 'string'
    ? v.trim()
    : typeof v === 'number'
      ? String(v)
      : null;
}
function code(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const n = s.toLowerCase().startsWith('0x')
    ? Number.parseInt(s.slice(2), 16)
    : Number(s);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function parseStructured(buf: Buffer): Record<string, unknown> | null {
  const text = buf.toString('utf8').trim();
  if (text.length > 250_000 || (!text.startsWith('{') && !text.startsWith('<')))
    return null;
  try {
    return record(
      text.startsWith('{')
        ? (JSON.parse(text) as unknown)
        : (xml.parse(text) as unknown),
    );
  } catch {
    return null;
  }
}
function pictureFrom(payload: Buffer): Buffer | null {
  // Keyingi boundary oldidagi CRLF rasmga kirmaydi.
  const end =
    payload.length >= 2 && payload.subarray(-2).equals(CRLF)
      ? payload.length - 2
      : payload.length;
  const image = payload.subarray(0, end);
  if (image.length < 100 || image.length > MAX_PICTURE_BYTES) return null;
  return image.subarray(0, 3).equals(JPEG_MAGIC) ? image : null;
}

/**
 * Diagnostika: multipart qismlarining sarlavhasi va hajmi (mazmunisiz).
 * Terminal rasm yuboryaptimi-yo‘qmi — logda shu ko‘rinadi.
 */
export function describeParts(contentType: string, body: Buffer): string {
  if (!/^multipart\//i.test(contentType)) {
    return `${contentType.split(';')[0]} (${body.length} B, multipart emas)`;
  }
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!match) return 'multipart, boundary yo‘q';
  const boundary = Buffer.from('--' + (match[1] || match[2]), 'utf8');
  const parts: string[] = [];
  let cursor = 0;
  while (
    (cursor = body.indexOf(boundary, cursor)) !== -1 &&
    parts.length < 10
  ) {
    const next = body.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;
    const part = body.subarray(cursor + boundary.length, next);
    const sep = part.indexOf(HEADER_SEP);
    const header =
      sep > -1 && sep < 4000
        ? part
            .subarray(0, sep)
            .toString('latin1')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160)
        : '?';
    const payload = sep > -1 ? part.subarray(sep + 4) : part;
    const jpeg = payload.subarray(0, 3).equals(JPEG_MAGIC) ? ', JPEG' : '';
    parts.push(`[${header}; ${payload.length} B${jpeg}]`);
    cursor = next;
  }
  return parts.join(' ') || 'qism topilmadi';
}

export function parsePush(
  contentType: string,
  body: Buffer,
): ParsedAccessEvent | null {
  let obj: Record<string, unknown> | null = null;
  let picture: Buffer | null = null;
  if (/^multipart\//i.test(contentType)) {
    // JSON/XML qismi event, image/jpeg qismi — yuz rasmi.
    const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    if (!match) return null;
    const boundary = Buffer.from('--' + (match[1] || match[2]), 'utf8');
    let cursor = 0;
    while ((cursor = body.indexOf(boundary, cursor)) !== -1) {
      const next = body.indexOf(boundary, cursor + boundary.length);
      if (next === -1) break;
      const part = body.subarray(cursor + boundary.length, next);
      const sep = part.indexOf(HEADER_SEP);
      if (sep > -1 && sep < 4000) {
        const header = part.subarray(0, sep).toString('latin1');
        const payload = part.subarray(sep + 4);
        if (
          !obj &&
          /content-type:\s*(application\/(json|xml)|text\/xml)/i.test(header)
        ) {
          obj = parseStructured(payload);
        } else if (!picture) {
          // Proshivkalar har xil: image/jpeg, image/pjpeg, application/octet-stream
          // yoki Content-Type umuman yo‘q. JPEG imzosi bo‘yicha aniqlanadi.
          picture = pictureFrom(payload);
        }
      }
      cursor = next;
    }
  } else obj = parseStructured(body);
  if (!obj) return null;
  const root = record(obj.EventNotificationAlert || obj);
  const access = record(
    root.AccessControllerEvent || obj.AccessControllerEvent,
  );
  const eventType = str(root.eventType) || '';
  return {
    eventType,
    major: code(
      access.majorEventType ??
        access.major ??
        root.majorEventType ??
        root.major,
    ),
    minor: code(
      access.subEventType ?? access.minor ?? root.subEventType ?? root.minor,
    ),
    serialNo: str(access.serialNo ?? root.serialNo),
    time: str(root.dateTime ?? access.time ?? root.time),
    pnfl: str(access.employeeNoString ?? access.employeeNo),
    verifyMode: str(access.currentVerifyMode ?? root.currentVerifyMode),
    pictureURL: str(access.pictureURL ?? root.pictureURL),
    picture,
  };
}

/** Navbatga yoziladigan ixcham event: faqat saqlanadigan yuz identifikatsiyasi. */
export interface FaceEvent {
  pnfl: string;
  serialNo: string;
  /** ISO, vaqt zonasi bilan. */
  eventAt: string;
  major: number;
  minor: number;
  pictureURL: string | null;
  picture: Buffer | null;
}

export type NormalizedPush =
  { ok: true; event: FaceEvent } | { ok: false; reason: string };

/**
 * Polling bilan aynan bir xil qoida: faqat major=5/minor=75 va
 * verifyMode=face eventlari davomatga kiradi. Qolganlari (heartbeat,
 * eshik holati, karta) qabul qilinadi-yu, saqlanmaydi.
 */
export function normalizePush(
  contentType: string,
  body: Buffer,
  now = Date.now(),
): NormalizedPush {
  const event = parsePush(contentType, body);
  if (!event) return { ok: false, reason: 'format' };
  if (
    event.eventType !== 'AccessControllerEvent' ||
    event.major !== 5 ||
    event.minor !== 75
  ) {
    return { ok: false, reason: 'not-face-event' };
  }
  if (!event.pnfl || !/^\d{14}$/.test(event.pnfl))
    return { ok: false, reason: 'pnfl' };
  if (event.verifyMode?.toLowerCase() !== 'face')
    return { ok: false, reason: 'verify-mode' };
  if (
    !event.serialNo ||
    !/^\d{1,20}$/.test(event.serialNo) ||
    BigInt(event.serialNo) > 18446744073709551615n
  ) {
    return { ok: false, reason: 'serial' };
  }
  if (!event.time || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(event.time))
    return { ok: false, reason: 'timezone' };
  const eventAt = new Date(event.time);
  const eventMs = eventAt.getTime();
  if (
    !Number.isFinite(eventMs) ||
    eventAt.getUTCFullYear() < 1000 ||
    eventAt.getUTCFullYear() > 9999 ||
    eventMs > now + 300_000
  ) {
    return { ok: false, reason: 'time' };
  }
  return {
    ok: true,
    event: {
      pnfl: event.pnfl,
      serialNo: BigInt(event.serialNo).toString(),
      eventAt: eventAt.toISOString(),
      major: event.major,
      minor: event.minor,
      pictureURL: event.pictureURL?.slice(0, 2000) || null,
      picture: event.picture,
    },
  };
}
