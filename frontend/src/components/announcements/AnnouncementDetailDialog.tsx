import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDate, formatDateTime } from '@/lib/date';
import type { AnnouncementDetail } from '@/types/announcement';

import { KindBadge } from './KindBadge';

function Body({ id }: { id: number }) {
    const { t } = useTranslation();
    const { data, loading, error, retry } = useApiQuery<AnnouncementDetail>(`/announcements/${id}`);

    if (loading) return <LoadingState rows={4} />;
    if (error || !data) return <ErrorState message={error || t('common.loadFailed')} onRetry={retry} />;

    const isTask = data.kind === 'TASK';
    return (
        <div className="space-y-4">
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <KindBadge kind={data.kind} />
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(data.createdAt)}</span>
                    {data.dueDate && <span className="text-xs text-muted-foreground">{t('announcements.list.due', { date: formatDate(data.dueDate) })}</span>}
                </div>
                <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{data.body}</p>
                {data.linkPath && <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{data.linkPath}</p>}
                {data.remindedAt && (
                    <p className="text-xs text-muted-foreground">{t('announcements.detail.reminded', { time: formatDateTime(data.remindedAt) })}</p>
                )}
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">{t('announcements.detail.recipient')}</TableHead>
                            <TableHead>{t('announcements.detail.school')}</TableHead>
                            <TableHead>{t('announcements.detail.read')}</TableHead>
                            {isTask && <TableHead className="pr-4">{t('announcements.detail.done')}</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.recipients.map((row) => (
                            <TableRow key={row.userId}>
                                <TableCell className="pl-4 whitespace-normal">
                                    <span className="font-medium [overflow-wrap:anywhere]">{row.name || '—'}</span>
                                    <span className="block text-xs text-muted-foreground">{t(`roles.${row.role}`, { defaultValue: row.role })}</span>
                                </TableCell>
                                <TableCell className="whitespace-normal">{row.school ?? '—'}</TableCell>
                                <TableCell>
                                    {row.readAt ? (
                                        <StatusBadge tone="success">{formatDateTime(row.readAt)}</StatusBadge>
                                    ) : (
                                        <StatusBadge tone="neutral">{t('announcements.detail.unread')}</StatusBadge>
                                    )}
                                </TableCell>
                                {isTask && (
                                    <TableCell className="pr-4">
                                        {row.doneAt ? (
                                            <StatusBadge tone="success">{formatDateTime(row.doneAt)}</StatusBadge>
                                        ) : (
                                            <StatusBadge tone="warning">{t('announcements.detail.notDone')}</StatusBadge>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export function AnnouncementDetailDialog({ id, title, onClose }: { id: number | null; title: string; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="[overflow-wrap:anywhere]">{title}</DialogTitle>
                    <DialogDescription>{t('announcements.detail.description')}</DialogDescription>
                </DialogHeader>
                {id !== null && <Body key={id} id={id} />}
            </DialogContent>
        </Dialog>
    );
}
