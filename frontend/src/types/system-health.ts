export type CheckStatus = 'ok' | 'warn' | 'crit';

export type CheckKey = 'database' | 'redis' | 'queues' | 'disk' | 'push' | 'stats' | 'photos' | 'terminals' | 'process';

export interface HealthCheck {
    key: CheckKey;
    status: CheckStatus;
    metrics: Record<string, number | string | null>;
    since: string;
}

export interface HealthSnapshot {
    generatedAt: string;
    overall: CheckStatus;
    checks: HealthCheck[];
}
