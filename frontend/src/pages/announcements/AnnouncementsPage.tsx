import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnnouncementDetailDialog } from '@/components/announcements/AnnouncementDetailDialog';
import { DataGapsCard } from '@/components/announcements/DataGapsCard';
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm';
import { KindBadge } from '@/components/announcements/KindBadge';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, formatDateTime } from '@/lib/date';
import type { AnnouncementsPage as PageData } from '@/types/announcement';

const LIMIT = 20;

/** Yuborilgan xabarlar va topshiriqlar: kim o‘qigan, kim bajargan. */
export function AnnouncementsPage() {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [creating, setCreating] = useState(false);
    const [opened, setOpened] = useState<{ id: number; title: string } | null>(null);
    const [notice, setNotice] = useState('');
    const query = useApiQuery<PageData>(`/announcements?page=${page}&limit=${LIMIT}`);
    const data = query.data;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('announcements.title')}
                description={t('announcements.description')}
                actions={
                    <Button type="button" onClick={() => { setNotice(''); setCreating(true); }}>
                        <Plus aria-hidden="true" />
                        {t('announcements.new')}
                    </Button>
                }
            />
            {notice && <SuccessNotice>{notice}</SuccessNotice>}

            <DataGapsCard onSent={() => query.retry()} />

            {query.loading && !data && <LoadingState />}
            {query.error && !data && <ErrorState message={query.error} onRetry={query.retry} />}
            {data && data.items.length === 0 && (
                <EmptyState icon={Megaphone} title={t('announcements.empty')} description={t('announcements.emptyHint')} />
            )}

            {data && data.items.length > 0 && (
                <ul className="grid list-none gap-3 lg:grid-cols-2">
                    {data.items.map((item) => {
                        const readPercent = item.recipients ? Math.round((100 * item.read) / item.recipients) : 0;
                        const donePercent = item.recipients ? Math.round((100 * item.done) / item.recipients) : 0;
                        return (
                            <li key={item.id}>
                                <Card size="sm" className="h-full gap-3 px-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="auto"
                                        onClick={() => setOpened({ id: item.id, title: item.title })}
                                        className="h-auto w-full flex-col items-stretch justify-start gap-3 rounded-lg p-0 text-left whitespace-normal hover:bg-transparent"
                                    >
                                        <span className="flex flex-wrap items-center gap-2">
                                            <KindBadge kind={item.kind} />
                                            <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</span>
                                            {item.dueDate && <span className="text-xs text-muted-foreground">{t('announcements.list.due', { date: formatDate(item.dueDate) })}</span>}
                                        </span>
                                        <span className="font-heading text-base font-bold [overflow-wrap:anywhere]">{item.title}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t('announcements.list.by', { name: item.sender || '—' })} · {t('announcements.list.recipients', { count: item.recipients })}
                                        </span>
                                        <span className="space-y-2">
                                            <span className="block space-y-1">
                                                <span className="flex justify-between text-xs">
                                                    <span>{t('announcements.list.read', { n: item.read, total: item.recipients })}</span>
                                                    <span className="tabular-nums text-muted-foreground">{readPercent}%</span>
                                                </span>
                                                <Progress value={readPercent} aria-label={t('announcements.detail.read')} />
                                            </span>
                                            {item.kind === 'TASK' && (
                                                <span className="block space-y-1">
                                                    <span className="flex justify-between text-xs">
                                                        <span>{t('announcements.list.done', { n: item.done, total: item.recipients })}</span>
                                                        <span className="tabular-nums text-muted-foreground">{donePercent}%</span>
                                                    </span>
                                                    <Progress value={donePercent} aria-label={t('announcements.detail.done')} />
                                                </span>
                                            )}
                                        </span>
                                    </Button>
                                </Card>
                            </li>
                        );
                    })}
                </ul>
            )}

            {data && data.total > LIMIT && (
                <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                        {t('common.pagination.prev')}
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {page} / {Math.ceil(data.total / LIMIT)}
                    </span>
                    <Button type="button" variant="outline" disabled={page >= Math.ceil(data.total / LIMIT)} onClick={() => setPage((current) => current + 1)}>
                        {t('common.pagination.next')}
                    </Button>
                </div>
            )}

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{t('announcements.new')}</DialogTitle>
                        <DialogDescription>{t('announcements.formDescription')}</DialogDescription>
                    </DialogHeader>
                    <AnnouncementForm
                        onCancel={() => setCreating(false)}
                        onSent={(count) => {
                            setCreating(false);
                            setPage(1);
                            setNotice(t('announcements.form.sent', { count }));
                            query.retry();
                        }}
                    />
                </DialogContent>
            </Dialog>

            <AnnouncementDetailDialog id={opened?.id ?? null} title={opened?.title ?? ''} onClose={() => setOpened(null)} />
        </div>
    );
}
