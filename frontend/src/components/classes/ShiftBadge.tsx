import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { CurrentClassShift } from '@/types/school-class';

/** Sinfning bugungi smenasi: «1-smena · 08:00–13:00». */
export function ShiftBadge({ shift }: { shift: CurrentClassShift | null }) {
    const { t } = useTranslation();

    if (!shift) {
        return <StatusBadge tone="warning">{t('classes.shift.none')}</StatusBadge>;
    }

    return (
        <span className="inline-flex flex-col gap-0.5">
            <StatusBadge tone={shift.code === 1 ? 'info' : 'primary'} dot={false}>
                {t('classes.shift.nameN', { code: shift.code })}
            </StatusBadge>
            <span className="text-xs text-muted-foreground tabular-nums">
                {shift.startTime}–{shift.endTime}
            </span>
        </span>
    );
}
