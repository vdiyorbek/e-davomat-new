import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatDateLong } from '@/lib/date';
import type { DailyAttendance } from '@/types/daily-attendance';

import { AttendanceCard } from './AttendanceCard';

interface Props {
    item: DailyAttendance;
    mode?: 'students' | 'teachers';
    iconOnly?: boolean;
}

export function AttendanceDetailsDialog({ item, mode = 'students', iconOnly = false }: Props) {
    const { t } = useTranslation();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size={iconOnly ? 'icon-sm' : 'sm'} aria-label={t('common.details')}>
                    <Eye aria-hidden="true" />
                    {!iconOnly && t('common.details')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t(`attendance.details.${mode}`)}</DialogTitle>
                    <DialogDescription>{formatDateLong(item.date)}</DialogDescription>
                </DialogHeader>
                <AttendanceCard item={item} />
            </DialogContent>
        </Dialog>
    );
}
