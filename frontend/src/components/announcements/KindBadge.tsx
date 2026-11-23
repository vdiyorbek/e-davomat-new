import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { StatusTone } from '@/components/common/StatusBadge';
import type { AnnouncementKind } from '@/types/announcement';

const TONE: Record<AnnouncementKind, StatusTone> = { INFO: 'info', TASK: 'primary', URGENT: 'danger' };

export function KindBadge({ kind }: { kind: AnnouncementKind }) {
    const { t } = useTranslation();
    return (
        <StatusBadge tone={TONE[kind]} dot={false}>
            {t(`announcements.kinds.${kind}`)}
        </StatusBadge>
    );
}
