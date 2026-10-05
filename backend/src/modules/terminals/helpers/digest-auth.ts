import { createHash, randomBytes } from 'node:crypto';

export function createDigestAuthorization(
  challenge: string,
  username: string,
  password: string,
  method: string,
  uri: string,
): string {
  if (!/^Digest\s+/i.test(challenge)) {
    throw new Error('Terminal Digest autentifikatsiyasini taklif qilmadi');
  }

  const values: Record<string, string> = {};

  const pattern =
    /([a-z][a-z0-9_-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/gi;

  for (const match of challenge.matchAll(pattern)) {
    values[match[1].toLowerCase()] =
      match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : match[3];
  }

  if (values.realm === undefined || !values.nonce) {
    throw new Error('Digest javobida realm yoki nonce mavjud emas');
  }

  const algorithm = (values.algorithm ?? 'MD5').toUpperCase();

  if (!['MD5', 'MD5-SESS', 'SHA-256', 'SHA-256-SESS'].includes(algorithm)) {
    throw new Error('Terminal Digest algoritmi qo‘llab-quvvatlanmaydi');
  }

  const qops = values.qop
    ?.split(',')
    .map((value) => value.trim().toLowerCase());

  if (qops && !qops.includes('auth')) {
    throw new Error('Terminalning Digest qop turi qo‘llab-quvvatlanmaydi');
  }

  const hashAlgorithm = algorithm.startsWith('SHA-256') ? 'sha256' : 'md5';

  const hash = (value: string): string =>
    createHash(hashAlgorithm).update(value, 'utf8').digest('hex');

  const quote = (value: string): string => {
    if (/[\r\n]/.test(value)) {
      throw new Error('Digest qiymati noto‘g‘ri');
    }

    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  };

  const cnonce = randomBytes(16).toString('hex');
  const nc = '00000001';

  let ha1 = hash(`${username}:${values.realm}:${password}`);

  if (algorithm.endsWith('-SESS')) {
    ha1 = hash(`${ha1}:${values.nonce}:${cnonce}`);
  }

  const ha2 = hash(`${method.toUpperCase()}:${uri}`);

  const response = qops
    ? hash(`${ha1}:${values.nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : hash(`${ha1}:${values.nonce}:${ha2}`);

  const userhash = values.userhash?.toLowerCase() === 'true';

  const fields = [
    `username=${quote(
      userhash ? hash(`${username}:${values.realm}`) : username,
    )}`,
    `realm=${quote(values.realm)}`,
    `nonce=${quote(values.nonce)}`,
    `uri=${quote(uri)}`,
    `response=${quote(response)}`,
    `algorithm=${algorithm.replace('-SESS', '-sess')}`,
  ];

  if (values.opaque !== undefined) {
    fields.push(`opaque=${quote(values.opaque)}`);
  }

  if (qops) {
    fields.push('qop=auth', `nc=${nc}`, `cnonce=${quote(cnonce)}`);
  } else if (algorithm.endsWith('-SESS')) {
    fields.push(`cnonce=${quote(cnonce)}`);
  }

  if (userhash) {
    fields.push('userhash=true');
  }

  return `Digest ${fields.join(', ')}`;
}
