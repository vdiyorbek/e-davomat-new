import { useState } from 'react';
import { Bell, CheckCheck, CircleCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';
import { authorizedPost } from '@/lib/auth-session';
import { formatDate, formatDateTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationsResponse } from '@/types/notification';

/** Bildirishnoma bosilganda ochiladigan sahifa. */
function targetOf(item: AppNotification): string {
    const p = item.payload;
    switch (item.type) {
        case 'EXCUSE_SUBMITTED':
            return '/attendance-excuses?status=PENDING';
        case 'EXCUSE_APPROVED':
        case 'EXCUSE_REJECTED':
            return '/homeroom?tab=excuses';
        case 'ABSENT_STREAK':
            return p.forInspector ? '/inspector/absentees' : `/homeroom?tab=absentees&class=${String(p.classId ?? '')}`;
        case 'SYSTEM_ALERT':
        case 'SYSTEM_RECOVERED':
            return '/system/health';
        case 'ANNOUNCEMENT':
        case 'ANNOUNCEMENT_REMINDER':
            return typeof p.linkPath === 'string' && p.linkPath.startsWith('/') && !p.linkPath.startsWith('//') ? p.linkPath : '/';
        default:
            return '/';
    }
}

/** Sanalarni foydalanuvchi ko‘radigan ko‘rinishga keltiradi. */
function vars(item: AppNotification) {
    const out: Record<string, string | number | boolean | null | undefined> = { ...item.payload };
    for (const key of ['from', 'to', 'since'] as const) {
        const value = item.payload[key];
        if (typeof value === 'string') out[key] = formatDate(value);
    }
    if (item.type === 'SYSTEM_ALERT' || item.type === 'SYSTEM_RECOVERED') {
        out.checkName = i18n.t(`systemHealth.checks.${String(item.payload.check)}.name`);
        out.statusName = i18n.t(`systemHealth.status.${String(item.payload.status)}`);
    }
    return out;
}

function textKey(item: AppNotification): string {
    return item.type === 'ABSENT_STREAK' && item.payload.forInspector
        ? 'notifications.types.ABSENT_STREAK_INSPECTOR'
        : `notifications.types.${item.type}`;
}

/** Sarlavhadagi qo‘ng‘iroqcha: o‘qilmagan bildirishnomalar soni va ro‘yxat. */
export function NotificationBell() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const { data, retry } = useApiQuery<NotificationsResponse>('/notifications?limit=20');

    // Har daqiqada yangilanadi (sahifa ochiq bo‘lsa).
    useInterval(retry, 60_000);

    const unread = data?.unreadCount ?? 0;

    async function openItem(item: AppNotification) {
        setOpen(false);
        if (!item.readAt) {
            try {
                await authorizedPost(`/notifications/${item.id}/read`, {});
            } catch {
                /* o‘qilgan deb belgilash muhim emas */
            }
            retry();
        }
        void navigate(targetOf(item));
    }

    async function markDone(item: AppNotification) {
        try {
            await authorizedPost(`/announcements/${String(item.payload.announcementId)}/done`, {});
        } finally {
            retry();
        }
    }

    async function readAll() {
        try {
            await authorizedPost('/notifications/read-all', {});
        } finally {
            retry();
        }
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) retry();
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="relative bg-card"
                    aria-label={unread > 0 ? t('notifications.openWithCount', { count: unread }) : t('notifications.open')}
                >
                    <Bell aria-hidden="true" />
                    {unread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-5 font-bold text-white tabular-nums">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <p className="font-heading text-sm font-bold">{t('notifications.title')}</p>
                    {unread > 0 && (
                        <Button type="button" variant="link" size="auto" className="text-xs" onClick={() => void readAll()}>
                            <CheckCheck aria-hidden="true" />
                            {t('notifications.readAll')}
                        </Button>
                    )}
                </div>
                {(data?.items ?? []).length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>
                ) : (
                    <div className="max-h-96 overflow-y-auto overscroll-contain">
                        <ul className="divide-y">
                            {(data?.items ?? []).map((item) => (
                                <li key={item.id}>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="auto"
                                        onClick={() => void openItem(item)}
                                        className={cn('w-full items-start gap-3 rounded-none px-4 py-3 whitespace-normal', !item.readAt && 'bg-primary/5')}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')}
                                        />
                                        <span className="min-w-0 space-y-0.5">
                                            {item.type === 'ANNOUNCEMENT' ? (
                                                <>
                                                    <span className="flex flex-wrap items-center gap-1.5">
                                                        {item.payload.kind === 'URGENT' && (
                                                            <span className="rounded bg-destructive px-1.5 text-[10px] leading-4 font-bold text-white uppercase">
                                                                {t('announcements.kinds.URGENT')}
                                                            </span>
                                                        )}
                                                        {item.payload.kind === 'TASK' && (
                                                            <span className="rounded bg-primary px-1.5 text-[10px] leading-4 font-bold text-primary-foreground uppercase">
                                                                {t('announcements.kinds.TASK')}
                                                            </span>
                                                        )}
                                                        <span className="text-sm leading-5 font-semibold [overflow-wrap:anywhere]">{String(item.payload.title ?? '')}</span>
                                                    </span>
                                                    <span className="line-clamp-3 block text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                                        {String(item.payload.body ?? '')}
                                                    </span>
                                                    {typeof item.payload.dueDate === 'string' && (
                                                        <span className="block text-xs text-muted-foreground">
                                                            {t('announcements.list.due', { date: formatDate(item.payload.dueDate) })}
                                                        </span>
                                                    )}
                                                    <span className="block text-xs text-muted-foreground tabular-nums">
                                                        {String(item.payload.sender ?? '')} · {formatDateTime(item.createdAt)}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="block text-sm leading-5 [overflow-wrap:anywhere]">{t(textKey(item), vars(item))}</span>
                                                    <span className="block text-xs text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</span>
                                                </>
                                            )}
                                        </span>
                                    </Button>
                                    {item.type === 'ANNOUNCEMENT' && item.payload.kind === 'TASK' && (
                                        <div className="flex justify-end px-4 pb-3">
                                            {item.doneAt ? (
                                                <span className="text-xs font-semibold text-success">{t('announcements.doneStamp')}</span>
                                            ) : (
                                                <Button type="button" size="sm" variant="outline" onClick={() => void markDone(item)}>
                                                    <CircleCheck aria-hidden="true" />
                                                    {t('announcements.markDone')}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
