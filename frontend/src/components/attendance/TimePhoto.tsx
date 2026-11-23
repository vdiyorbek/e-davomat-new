import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate, formatTime } from '@/lib/date';
import type { AttendancePhotoStatus } from '@/types/daily-attendance';
import { AttendancePhoto } from './AttendancePhoto';
import { Button } from '@/components/ui/button';

interface TimePhotoProps {
    /** Kirish/chiqish vaqti (ISO). */
    time: string | null;
    /** Turniket rasmi manzili; rasm yuklanmagan bo‘lsa null. */
    url: string | null;
    status?: AttendancePhotoStatus | null;
    /** «Kirish» yoki «Chiqish». */
    label: string;
    name: string;
    date: string;
}

/**
 * Kirish/chiqish vaqti. Rasm bor bo‘lsa — vaqtni bosganda turniket olgan rasm ochiladi.
 * Rasm hali yuklanmagan bo‘lsa, vaqt oddiy matn bo‘lib qoladi (sababi izohda).
 */
export function TimePhoto({ time, url, status, label, name, date }: TimePhotoProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    if (!time) return <>—</>;
    const text = formatTime(time);

    if (!url) {
        const reason = status === 'PENDING' ? t('attendance.photoPending') : status === 'FAILED' ? t('attendance.photoFailed') : t('attendance.noPhoto');
        return <span title={reason}>{text}</span>;
    }

    return (
        <>
            <Button variant="link" size="auto"
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`${label} ${text}: ${t('attendance.photoOpen')}`}
                className="inline-flex items-center gap-1 rounded-sm text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                {text}
                <Camera aria-hidden="true" className="size-3.5" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="[overflow-wrap:anywhere]">{name}</DialogTitle>
                        <DialogDescription>
                            {label} · {formatDate(date)} {text}
                        </DialogDescription>
                    </DialogHeader>
                    <AttendancePhoto url={url} alt={`${name} — ${label} ${text}`} />
                </DialogContent>
            </Dialog>
        </>
    );
}
