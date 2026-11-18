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
};

const xml = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: false });
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : null;
}
function code(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const n = s.toLowerCase().startsWith('0x') ? Number.parseInt(s.slice(2), 16) : Number(s);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function parseStructured(buf: Buffer): Record<string, unknown> | null {
  const text = buf.toString('utf8').trim();
  if (text.length > 250_000 || (!text.startsWith('{') && !text.startsWith('<'))) return null;
  try { return record(text.startsWith('{') ? JSON.parse(text) as unknown : xml.parse(text) as unknown); }
  catch { return null; }
}

export function parsePush(contentType: string, body: Buffer): ParsedAccessEvent | null {
  let obj: Record<string, unknown> | null = null;
  if (/^multipart\//i.test(contentType)) {
    // Only structured XML/JSON parts; never decode or store attached face images.
    const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    if (!match) return null;
    const boundary = Buffer.from('--' + (match[1] || match[2]), 'utf8');
    const headerSep = Buffer.from('\r\n\r\n');
    let cursor = 0;
    while ((cursor = body.indexOf(boundary, cursor)) !== -1) {
      const next = body.indexOf(boundary, cursor + boundary.length);
      if (next === -1) break;
      const part = body.subarray(cursor + boundary.length, next);
      const sep = part.indexOf(headerSep);
      if (sep > -1 && sep < 4000) {
        const header = part.subarray(0, sep).toString('latin1');
        if (/content-type:\s*(application\/(json|xml)|text\/xml)/i.test(header)) {
          const payload = part.subarray(sep + 4);
          const candidate = parseStructured(payload);
          if (candidate) { obj = candidate; break; }
        }
      }
      cursor = next;
    }
  } else obj = parseStructured(body);
  if (!obj) return null;
  const root = record(obj.EventNotificationAlert || obj);
  const access = record(root.AccessControllerEvent || obj.AccessControllerEvent);
  const eventType = str(root.eventType) || '';
  return {
    eventType,
    major: code(access.majorEventType ?? access.major ?? root.majorEventType ?? root.major),
    minor: code(access.subEventType ?? access.minor ?? root.subEventType ?? root.minor),
    serialNo: str(access.serialNo ?? root.serialNo),
    time: str(root.dateTime ?? access.time ?? root.time),
    pnfl: str(access.employeeNoString ?? access.employeeNo),
    verifyMode: str(access.currentVerifyMode ?? root.currentVerifyMode),
    pictureURL: str(access.pictureURL ?? root.pictureURL),
  };
}
