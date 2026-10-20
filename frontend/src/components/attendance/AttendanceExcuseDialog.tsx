import { useState } from 'react';
import { FileCheck2 } from 'lucide-react';
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
import type { DailyAttendance } from '@/types/daily-attendance';

import { AttendanceExcuseForm } from './AttendanceExcuseForm';

interface Props {
    item: DailyAttendance;
    onSaved: () => void;
}

export function AttendanceExcuseDialog({ item, onSaved }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="secondary" size="sm">
                    <FileCheck2 aria-hidden="true" />
                    {t('excuses.markExcused')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('excuses.markTitle')}</DialogTitle>
                    <DialogDescription>{t('excuses.markDescription')}</DialogDescription>
                </DialogHeader>
                {open && (
                    <AttendanceExcuseForm
                        item={item}
                        onSaved={() => {
                            setOpen(false);
                            onSaved();
                        }}
                        onCancel={() => setOpen(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
