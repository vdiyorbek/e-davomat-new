import { useState } from 'react';
import { KeyRound, Loader2, RefreshCw, Save, Trash2, Webhook } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedDelete, authorizedPost, authorizedPut } from '@/lib/auth-session';

type Source = 'db' | 'env' | null;

interface Config {
    token: { set: boolean; source: Source; hint: string | null };
    secret: { set: boolean; source: Source };
    publicUrl: string;
    publicUrlSource: Source;
}

interface SaveResult extends Config {
    username: string | null;
    webhookNeedsSetup: boolean;
}

/** Telegram bot ulanishi: token va maxfiy so‘z bazada shifrlanadi, token brauzerga qaytarilmaydi. */
export function TelegramConfigCard() {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const query = useApiQuery<Config>('/parent-notify/config');
    const [token, setToken] = useState('');
    // null = foydalanuvchi tegmagan: serverdagi qiymat ko‘rsatiladi.
    const [urlDraft, setUrlDraft] = useState<string | null>(null);
    const [busy, setBusy] = useState<'save' | 'secret' | 'clear' | 'webhook' | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [needsWebhook, setNeedsWebhook] = useState(false);

    const config = query.data;
    const url = urlDraft ?? config?.publicUrl ?? '';
    const dirty = token.trim() !== '' || (urlDraft !== null && urlDraft.trim() !== (config?.publicUrl ?? ''));

    async function run<T>(kind: NonNullable<typeof busy>, action: () => Promise<T>): Promise<T | null> {
        setBusy(kind);
        setError('');
        setNotice('');
        try {
            return await action();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('systemSettings.telegram.failed'));
            return null;
        } finally {
            setBusy(null);
        }
    }

    async function save(regenerateSecret = false) {
        const body: Record<string, unknown> = { regenerateSecret };
        if (token.trim()) body.token = token.trim();
        if (urlDraft !== null) body.publicUrl = urlDraft.trim();
        const result = await run(regenerateSecret ? 'secret' : 'save', () => authorizedPut<SaveResult>('/parent-notify/config', body));
        if (!result) return;
        setToken('');
        setUrlDraft(null);
        setNeedsWebhook(result.webhookNeedsSetup);
        setNotice(result.username ? t('systemSettings.telegram.savedBot', { name: result.username }) : t('systemSettings.telegram.saved'));
        query.retry();
    }

    async function clearToken() {
        if (!(await confirm({ title: t('systemSettings.telegram.clearTitle'), description: t('systemSettings.telegram.clearText'), confirmLabel: t('systemSettings.telegram.clear'), destructive: true }))) return;
        if (await run('clear', () => authorizedDelete('/parent-notify/config/token'))) {
            setNotice(t('systemSettings.telegram.cleared'));
            query.retry();
        }
    }

    async function setupWebhook() {
        if (await run('webhook', () => authorizedPost('/parent-notify/webhook/setup', {}))) {
            setNeedsWebhook(false);
            setNotice(t('systemSettings.telegram.webhookDone'));
        }
    }

    const sourceLabel = (source: Source) => (source ? t(`systemSettings.telegram.source.${source}`) : '');

    return (
        <section aria-labelledby="telegram-title" className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            {dialog}
            <div className="min-w-0">
                <h2 id="telegram-title" className="font-heading text-base font-bold">
                    {t('systemSettings.telegram.title')}
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{t('systemSettings.telegram.description')}</p>
            </div>

            {query.loading && !config && <LoadingState />}
            {query.error && !config && <ErrorState message={query.error} onRetry={query.retry} />}

            {config && (
                <div className="space-y-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-muted-foreground">{t('systemSettings.telegram.token')}</dt>
                            <dd className="mt-1 flex flex-wrap items-center gap-2">
                                <StatusBadge tone={config.token.set ? 'success' : 'warning'}>
                                    {config.token.set ? t('systemSettings.telegram.set') : t('systemSettings.telegram.notSet')}
                                </StatusBadge>
                                {config.token.hint && <span className="text-xs text-muted-foreground">{config.token.hint}</span>}
                                {config.token.source && <span className="text-xs text-muted-foreground">({sourceLabel(config.token.source)})</span>}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">{t('systemSettings.telegram.secret')}</dt>
                            <dd className="mt-1 flex flex-wrap items-center gap-2">
                                <StatusBadge tone={config.secret.set ? 'success' : 'warning'}>
                                    {config.secret.set ? t('systemSettings.telegram.set') : t('systemSettings.telegram.notSet')}
                                </StatusBadge>
                                {config.secret.source && <span className="text-xs text-muted-foreground">({sourceLabel(config.secret.source)})</span>}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">{t('systemSettings.telegram.publicUrl')}</dt>
                            <dd className="mt-1 break-all text-xs">
                                {config.publicUrl || '—'} {config.publicUrlSource && <span className="text-muted-foreground">({sourceLabel(config.publicUrlSource)})</span>}
                            </dd>
                        </div>
                    </dl>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm">
                            <span className="text-xs font-medium text-muted-foreground">{t('systemSettings.telegram.newToken')}</span>
                            <Input type="password" autoComplete="off" spellCheck={false} placeholder="123456:ABC…" value={token} onChange={(event) => setToken(event.target.value)} />
                        </label>
                        <label className="space-y-1.5 text-sm">
                            <span className="text-xs font-medium text-muted-foreground">{t('systemSettings.telegram.publicUrl')}</span>
                            <Input type="url" autoComplete="off" spellCheck={false} placeholder="https://davomat.example.uz" value={url} onChange={(event) => setUrlDraft(event.target.value)} />
                        </label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('systemSettings.telegram.hint')}</p>

                    <div className="flex flex-wrap gap-2">
                        <Button type="button" disabled={busy !== null || !dirty} onClick={() => void save()}>
                            {busy === 'save' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                            {t('systemSettings.telegram.save')}
                        </Button>
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void save(true)}>
                            {busy === 'secret' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <KeyRound aria-hidden="true" />}
                            {t('systemSettings.telegram.regenerate')}
                        </Button>
                        <Button type="button" variant="outline" disabled={busy !== null || !config.token.set || !config.secret.set || !config.publicUrl} onClick={() => void setupWebhook()}>
                            {busy === 'webhook' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Webhook aria-hidden="true" />}
                            {t('systemSettings.telegram.webhook')}
                        </Button>
                        {config.token.source === 'db' && (
                            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void clearToken()}>
                                <Trash2 aria-hidden="true" />
                                {t('systemSettings.telegram.clear')}
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" aria-label={t('systemSettings.telegram.refresh')} disabled={busy !== null} onClick={query.retry}>
                            <RefreshCw aria-hidden="true" />
                        </Button>
                    </div>

                    {needsWebhook && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">{t('systemSettings.telegram.needsWebhook')}</p>}
                    {notice && (
                        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
                            {notice}
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="text-xs text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
