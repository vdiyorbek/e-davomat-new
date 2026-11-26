import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Send, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedPost } from '@/lib/auth-session';
import { academicYearFor, formatDateTime, formatNumber, todayInTashkent } from '@/lib/date';
import { schoolScopeOptions } from '@/lib/school-scope';
import { cn } from '@/lib/utils';
import type { School } from '@/types/school';

const TYPES = ['ANNOUNCEMENT', 'URGENT', 'REMINDER', 'CONGRATS', 'INFO'] as const;
const SCOPES = ['ALL', 'REGION', 'DISTRICT', 'SCHOOL', 'CLASS'] as const;
const LANGUAGES = [
    { code: 'uz', label: 'O‘zbekcha' },
    { code: 'uz-Cyrl', label: 'Ўзбекча' },
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
    { code: 'kk', label: 'Қазақша' },
    { code: 'ky', label: 'Кыргызча' },
    { code: 'tg', label: 'Тоҷикӣ' },
] as const;
const MAX_TITLE = 120;
const MAX_BODY = 3000;

type Scope = (typeof SCOPES)[number];
type BroadcastType = (typeof TYPES)[number];
type Texts = Record<string, { title: string; body: string }>;

interface Audience {
    scope: Scope;
    regionId?: number;
    districtId?: number;
    schoolId?: number;
    classId?: number;
}

interface Preview {
    schools: number;
    children: number;
    phones: number;
    reachable: number;
}

interface BroadcastRow {
    id: number;
    type: BroadcastType;
    title: string | null;
    preview: string;
    audience: Audience;
    audienceName: string;
    createdAt: string;
    total: number;
    sent: number;
    pending: number;
    failed: number;
    skipped: number;
    status: 'SENDING' | 'DONE' | 'CANCELED';
}

const STATUS_TONE: Record<BroadcastRow['status'], StatusTone> = { SENDING: 'info', DONE: 'success', CANCELED: 'neutral' };

function ClassSelect({ schoolId, value, onChange }: { schoolId: string; value: string; onChange: (value: string) => void }) {
    const { t } = useTranslation();
    const params = new URLSearchParams({ schoolId, academicYear: academicYearFor(todayInTashkent()) });
    const classes = useApiQuery<{ id: number; name: string }[]>(`/classes?${params.toString()}`);
    return (
        <Field label={t('common.class')}>
            <SelectField
                value={value}
                onValueChange={onChange}
                placeholder={t('parentAdmin.broadcast.pick')}
                options={(classes.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
                disabled={classes.loading || Boolean(classes.error)}
                aria-label={t('common.class')}
            />
        </Field>
    );
}

/** Bosh administrator: ota-onalarga Telegram orqali e’lon va boshqa xabarlar. */
export function BroadcastCard() {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const schools = useApiQuery<School[]>('/schools');
    const history = useApiQuery<BroadcastRow[]>('/parent-notify/broadcasts');

    const [type, setType] = useState<BroadcastType>('ANNOUNCEMENT');
    const [scope, setScope] = useState<Scope>('ALL');
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [classId, setClassId] = useState('');
    const [language, setLanguage] = useState<string>('uz');
    const [texts, setTexts] = useState<Texts>({});
    const [preview, setPreview] = useState<Preview | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const options = useMemo(() => schoolScopeOptions(schools.data, regionId, districtId), [schools.data, regionId, districtId]);

    const audience = useMemo<Audience | null>(() => {
        if (scope === 'ALL') return { scope };
        if (scope === 'REGION') return regionId ? { scope, regionId: Number(regionId) } : null;
        if (scope === 'DISTRICT') return districtId ? { scope, districtId: Number(districtId) } : null;
        if (scope === 'SCHOOL') return schoolId ? { scope, schoolId: Number(schoolId) } : null;
        return classId ? { scope, classId: Number(classId) } : null;
    }, [scope, regionId, districtId, schoolId, classId]);

    // Qabul qiluvchilar soni: guruh tanlanganda avtomatik hisoblanadi.
    useEffect(() => {
        if (!audience) return;
        let cancelled = false;
        void authorizedPost<Preview>('/parent-notify/broadcasts/preview', { audience })
            .then((result) => {
                if (cancelled) return;
                setPreview(result);
                setPreviewError('');
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setPreview(null);
                setPreviewError(err instanceof Error ? err.message : t('parentAdmin.failed'));
            });
        return () => {
            cancelled = true;
        };
    }, [audience, t]);

    // Yuborilayotgan xabar bo‘lsa, holat har 8 soniyada yangilanadi.
    const sending = (history.data ?? []).some((item) => item.status === 'SENDING');
    useInterval(history.retry, sending ? 8000 : null);

    function changeScope(next: string) {
        setScope(next as Scope);
        setPreview(null);
        setPreviewError('');
    }

    function setField(field: 'title' | 'body', value: string) {
        setTexts((current) => ({ ...current, [language]: { title: current[language]?.title ?? '', body: current[language]?.body ?? '', [field]: value } }));
    }

    const uzBody = texts.uz?.body?.trim() ?? '';
    const current = texts[language] ?? { title: '', body: '' };
    const ready = Boolean(audience) && uzBody.length >= 3 && !busy && (preview?.reachable ?? 0) > 0;

    async function send() {
        if (!audience || !preview) return;
        const ok = await confirm({
            title: t('parentAdmin.broadcast.confirmTitle'),
            description: t('parentAdmin.broadcast.confirmText', {
                count: formatNumber(preview.reachable),
                type: t(`parentAdmin.broadcast.types.${type}`),
            }),
            confirmLabel: t('parentAdmin.broadcast.send'),
        });
        if (!ok) return;
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const body: Texts = {};
            for (const [code, value] of Object.entries(texts)) {
                if (value.body.trim()) body[code] = { title: value.title.trim(), body: value.body.trim() };
            }
            const created = await authorizedPost<BroadcastRow>('/parent-notify/broadcasts', { type, texts: body, audience });
            setSuccess(t('parentAdmin.broadcast.queued', { count: formatNumber(created.total) }));
            setTexts({});
            setLanguage('uz');
            history.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        } finally {
            setBusy(false);
        }
    }

    async function cancel(item: BroadcastRow) {
        const ok = await confirm({
            title: t('parentAdmin.broadcast.cancelTitle'),
            description: t('parentAdmin.broadcast.cancelText', { count: formatNumber(item.pending) }),
            confirmLabel: t('parentAdmin.broadcast.cancel'),
        });
        if (!ok) return;
        try {
            await authorizedPost(`/parent-notify/broadcasts/${item.id}/cancel`, {});
            history.retry();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('parentAdmin.failed'));
        }
    }

    const audienceLabel = (item: BroadcastRow) =>
        item.audience.scope === 'ALL'
            ? t('parentAdmin.broadcast.scopes.ALL')
            : `${t(`parentAdmin.broadcast.scopes.${item.audience.scope}`)}: ${item.audienceName}`;

    return (
        <Card className="gap-4 p-4 sm:p-5">
            {dialog}
            <div>
                <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                    <Megaphone aria-hidden="true" className="size-4 text-primary" />
                    {t('parentAdmin.broadcast.title')}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('parentAdmin.broadcast.description')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('parentAdmin.broadcast.type')}>
                    <SelectField
                        value={type}
                        onValueChange={(value) => setType(value as BroadcastType)}
                        options={TYPES.map((value) => ({ value, label: t(`parentAdmin.broadcast.types.${value}`) }))}
                        aria-label={t('parentAdmin.broadcast.type')}
                    />
                </Field>
                <Field label={t('parentAdmin.broadcast.audience')}>
                    <SelectField
                        value={scope}
                        onValueChange={changeScope}
                        options={SCOPES.map((value) => ({ value, label: t(`parentAdmin.broadcast.scopes.${value}`) }))}
                        aria-label={t('parentAdmin.broadcast.audience')}
                    />
                </Field>
                {scope !== 'ALL' && (
                    <Field label={t('common.region')}>
                        <SelectField
                            value={regionId}
                            onValueChange={(value) => {
                                setRegionId(value);
                                setDistrictId('');
                                setSchoolId('');
                                setClassId('');
                            }}
                            placeholder={t('parentAdmin.broadcast.pick')}
                            options={options.regions}
                            aria-label={t('common.region')}
                        />
                    </Field>
                )}
                {(scope === 'DISTRICT' || scope === 'SCHOOL' || scope === 'CLASS') && (
                    <Field label={t('common.district')}>
                        <SelectField
                            value={districtId}
                            onValueChange={(value) => {
                                setDistrictId(value);
                                setSchoolId('');
                                setClassId('');
                            }}
                            placeholder={t('parentAdmin.broadcast.pick')}
                            options={options.districts}
                            aria-label={t('common.district')}
                        />
                    </Field>
                )}
                {(scope === 'SCHOOL' || scope === 'CLASS') && (
                    <Field label={t('common.school')}>
                        <SelectField
                            value={schoolId}
                            onValueChange={(value) => {
                                setSchoolId(value);
                                setClassId('');
                            }}
                            placeholder={t('parentAdmin.broadcast.pick')}
                            options={options.schools}
                            aria-label={t('common.school')}
                        />
                    </Field>
                )}
                {scope === 'CLASS' && schoolId && <ClassSelect schoolId={schoolId} value={classId} onChange={setClassId} />}
            </div>

            <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('parentAdmin.broadcast.language')}>
                    {LANGUAGES.map((item) => {
                        const filled = Boolean(texts[item.code]?.body?.trim());
                        return (
                            <button
                                key={item.code}
                                type="button"
                                role="tab"
                                aria-selected={language === item.code}
                                onClick={() => setLanguage(item.code)}
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                                    language === item.code ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                                )}
                            >
                                {item.label}
                                {filled && <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />}
                                {item.code === 'uz' && <span aria-hidden="true">*</span>}
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{t('parentAdmin.broadcast.languageHint')}</p>
                <Field label={t('parentAdmin.broadcast.subject')} htmlFor="broadcast-title">
                    <Input
                        id="broadcast-title"
                        value={current.title}
                        maxLength={MAX_TITLE}
                        onChange={(event) => setField('title', event.target.value)}
                    />
                </Field>
                <Field
                    label={t('parentAdmin.broadcast.body')}
                    htmlFor="broadcast-body"
                    required={language === 'uz'}
                    hint={t('parentAdmin.broadcast.chars', { count: current.body.length, max: MAX_BODY })}
                >
                    <Textarea
                        id="broadcast-body"
                        value={current.body}
                        maxLength={MAX_BODY}
                        rows={5}
                        onChange={(event) => setField('body', event.target.value)}
                    />
                </Field>
            </div>

            <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-sm">
                {!audience ? (
                    <p className="text-muted-foreground">{t('parentAdmin.broadcast.pickAudience')}</p>
                ) : previewError ? (
                    <p role="alert" className="text-destructive">{previewError}</p>
                ) : preview ? (
                    <>
                        <p className="font-semibold">
                            {t('parentAdmin.broadcast.reach', {
                                count: formatNumber(preview.reachable),
                                children: formatNumber(preview.children),
                                schools: formatNumber(preview.schools),
                            })}
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">{t('parentAdmin.broadcast.reachHint')}</p>
                    </>
                ) : (
                    <p className="text-muted-foreground">…</p>
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                    {type === 'URGENT' ? t('parentAdmin.broadcast.urgentNote') : t('parentAdmin.broadcast.quietNote')}
                </p>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {success && <p role="status" className="text-sm font-medium text-success">{success}</p>}
            <div className="flex justify-end">
                <Button type="button" disabled={!ready} onClick={() => void send()}>
                    <Send aria-hidden="true" />
                    {t('parentAdmin.broadcast.send')}
                </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-bold">{t('parentAdmin.broadcast.history')}</h3>
                {history.data && history.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('parentAdmin.broadcast.historyEmpty')}</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">{t('parentAdmin.broadcast.type')}</TableHead>
                                    <TableHead>{t('parentAdmin.broadcast.audience')}</TableHead>
                                    <TableHead>{t('parentAdmin.broadcast.progress')}</TableHead>
                                    <TableHead>{t('parentAdmin.broadcast.statusLabel')}</TableHead>
                                    <TableHead className="pr-4" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(history.data ?? []).map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="max-w-72 pl-4">
                                            <p className="font-semibold">{t(`parentAdmin.broadcast.types.${item.type}`)}</p>
                                            <p className="truncate text-xs text-muted-foreground">{item.title || item.preview}</p>
                                            <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                                        </TableCell>
                                        <TableCell className="text-sm">{audienceLabel(item)}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                            {formatNumber(item.sent)} / {formatNumber(item.total)}
                                            {item.failed > 0 && (
                                                <span className="ml-1 text-xs text-destructive">
                                                    ({t('parentAdmin.broadcast.failedCount', { count: item.failed })})
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge tone={STATUS_TONE[item.status]}>{t(`parentAdmin.broadcast.status.${item.status}`)}</StatusBadge>
                                        </TableCell>
                                        <TableCell className="pr-4 text-right">
                                            {item.status === 'SENDING' && (
                                                <Button type="button" size="sm" variant="outline" onClick={() => void cancel(item)}>
                                                    <XCircle aria-hidden="true" />
                                                    {t('parentAdmin.broadcast.cancel')}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </Card>
    );
}
