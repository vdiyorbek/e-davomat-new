export type CheckStatus = 'ok' | 'warn' | 'crit';

export type CheckKey =
  | 'database'
  | 'redis'
  | 'queues'
  | 'disk'
  | 'push'
  | 'stats'
  | 'photos'
  | 'terminals'
  | 'process';

export interface CheckResult {
  key: CheckKey;
  status: CheckStatus;
  /** Frontend tarjima shablonlari uchun raqam/matn qiymatlari. */
  metrics: Record<string, number | string | null>;
}

export interface HealthSnapshot {
  generatedAt: string;
  overall: CheckStatus;
  checks: (CheckResult & { since: string })[];
}

const ORDER: Record<CheckStatus, number> = { ok: 0, warn: 1, crit: 2 };

export function worst(statuses: CheckStatus[]): CheckStatus {
  return statuses.reduce<CheckStatus>(
    (acc, status) => (ORDER[status] > ORDER[acc] ? status : acc),
    'ok',
  );
}
