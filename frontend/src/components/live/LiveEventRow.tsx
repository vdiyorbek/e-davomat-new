import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import { authorizedGet } from '@/lib/auth-session';
import { formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { LiveEvent, LiveTerminal } from '@/types/live';

function EventPhoto({ event, large }: { event: LiveEvent; large?: boolean }) {
    const [url, setUrl] = useState('');
    const [broken, setBroken] = useState(false);

    useEffect(() => {
        if (!event.hasPhoto) return;
        const controller = new AbortController();
        let objectUrl = '';

        authorizedGet<Blob>(`/live/events/${event.eventId}/photo`, controller.signal, 'blob')
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch(() => undefined);

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [event.eventId, event.hasPhoto]);

    const initials = event.person ? `${event.person.lastName[0] ?? ''}${event.person.firstName[0] ?? ''}` : '?';
    const size = large ? 'size-28 sm:size-36 text-3xl' : 'size-12 text-sm';

    return url && !broken ? (
        <img src={url} alt="" onError={() => setBroken(true)} className={cn('shrink-0 rounded-xl object-cover', size)} />
    ) : (
        <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-xl bg-muted font-heading font-bold text-muted-foreground', size)}>
            {initials}
        </span>
    );
}

interface LiveEventRowProps {
    event: LiveEvent;
    terminal: LiveTerminal | undefined;
    large?: boolean;
    fresh?: boolean;
}

export function LiveEventRow({ event, terminal, large, fresh }: LiveEventRowProps) {
    const { t } = useTranslation();
    const name = event.person
        ? [event.person.lastName, event.person.firstName, event.person.middleName].filter(Boolean).join(' ')
        : t('live.unknownPerson');
    const isIn = event.direction === 'IN';

    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors',
                large && 'gap-5 p-5',
                fresh && 'animate-in fade-in slide-in-from-top-2 border-primary/40 bg-primary/5',
            )}
        >
            <EventPhoto event={event} large={large} />
            <div className="min-w-0 flex-1 space-y-1">
                <p className={cn('font-semibold [overflow-wrap:anywhere]', large ? 'font-heading text-2xl' : 'text-sm')}>{name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {event.membershipType && (
                        <StatusBadge tone={event.membershipType === 'TEACHER' ? 'primary' : 'info'} dot={false}>
                            {event.membershipType === 'TEACHER' ? t('live.teacher') : t('live.student')}
                        </StatusBadge>
                    )}
                    {event.className && <StatusBadge tone="neutral" dot={false}>{event.className}</StatusBadge>}
                    {!event.person && <StatusBadge tone="warning">{t('live.notMember')}</StatusBadge>}
                </div>
                {terminal && <p className="truncate text-xs text-muted-foreground">{terminal.name}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        isIn ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                    )}
                >
                    {isIn ? <LogIn aria-hidden="true" className="size-3.5" /> : <LogOut aria-hidden="true" className="size-3.5" />}
                    {isIn ? t('live.in') : t('live.out')}
                </span>
                <time dateTime={event.eventAt} className={cn('font-semibold tabular-nums', large ? 'text-xl' : 'text-sm')}>
                    {formatTime(event.eventAt)}
                </time>
            </div>
        </div>
    );
}
