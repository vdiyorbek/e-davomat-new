import { useState } from 'react';
import { Check, Copy, KeyRound, RadioTower, ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date';
import { disablePushToken, generatePushToken } from '@/lib/terminals-api';
import type { PushTokenResponse } from '@/lib/terminals-api';
import type { Terminal } from '@/types/terminal';

function CopyValue({ label, value }: { label: string; value: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-xs break-all">{value}</code>
                <Button type="button" variant="outline" size="icon" aria-label={t('terminals.push.copy', { label })} onClick={() => void copy()}>
                    {copied ? <Check aria-hidden="true" className="text-success" /> : <Copy aria-hidden="true" />}
                </Button>
            </div>
        </div>
    );
}

/** Push rejimidagi terminal: token yaratish va terminalga yoziladigan manzil. */
export function TerminalPushPanel({ terminal, canManage, onChanged }: { terminal: Terminal; canManage: boolean; onChanged: () => void }) {
    const { t } = useTranslation();
    const [issued, setIssued] = useState<PushTokenResponse | null>(null);
    // Ota sahifa tanlangan terminal obyektini yangilamaydi — holatni shu yerda kuzatamiz.
    const [enabled, setEnabled] = useState(terminal.pushEnabled);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function run(action: () => Promise<void>) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
            onChanged();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('terminals.push.failed'));
        } finally {
            setBusy(false);
        }
    }

    function issue() {
        if (enabled && !window.confirm(t('terminals.push.confirmRegenerate'))) return;
        void run(async () => {
            setIssued(await generatePushToken(terminal.id));
            setEnabled(true);
        });
    }

    function revoke() {
        if (!window.confirm(t('terminals.push.confirmDisable'))) return;
        void run(async () => {
            await disablePushToken(terminal.id);
            setIssued(null);
            setEnabled(false);
        });
    }

    // Terminal sozlamasi uchun: server manzili va porti alohida kiritiladi.
    const target = (() => {
        if (!issued?.url) return null;
        try {
            const url = new URL(issued.url);
            return { host: url.hostname, port: url.port || (url.protocol === 'https:' ? '443' : '80') };
        } catch {
            return null;
        }
    })();

    return (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                        <RadioTower aria-hidden="true" className="size-4" />
                        {t('terminals.push.title')}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {enabled ? t('terminals.push.enabled') : t('terminals.push.noToken')}
                    </p>
                </div>
                <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">{t('terminals.push.lastReceived')}</dt>
                    <dd className="tabular-nums">{formatDateTime(terminal.pushLastReceivedAt)}</dd>
                    <dt className="text-muted-foreground">{t('terminals.push.lastEvent')}</dt>
                    <dd className="tabular-nums">{formatDateTime(terminal.pushLastEventAt)}</dd>
                </dl>
            </div>

            {issued && (
                <div className="space-y-3 rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium text-warning">{t('terminals.push.onceWarning')}</p>
                    {issued.url && <CopyValue label={t('terminals.push.fullUrl')} value={issued.url} />}
                    <CopyValue label={t('terminals.push.path')} value={issued.path} />
                    {!issued.url && <p className="text-xs text-muted-foreground">{t('terminals.push.noPublicUrl')}</p>}
                    <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                        <li>{t('terminals.push.steps.open')}</li>
                        <li>
                            {target
                                ? t('terminals.push.steps.address', { host: target.host, port: target.port })
                                : t('terminals.push.steps.addressGeneric')}
                        </li>
                        <li>{t('terminals.push.steps.url')}</li>
                        <li>{t('terminals.push.steps.picture')}</li>
                        <li>{t('terminals.push.steps.test')}</li>
                    </ol>
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {canManage && terminal.isActive && (
                <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={issue}>
                        <KeyRound aria-hidden="true" />
                        {enabled ? t('terminals.push.regenerate') : t('terminals.push.generate')}
                    </Button>
                    {enabled && (
                        <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={revoke}>
                            <ShieldOff aria-hidden="true" />
                            {t('terminals.push.disable')}
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
}
