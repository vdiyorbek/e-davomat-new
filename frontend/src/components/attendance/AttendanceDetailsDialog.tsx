
import { Dialog } from 'radix-ui';
import { Eye, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AttendanceCard } from './AttendanceCard';

import type { DailyAttendance } from '@/types/daily-attendance';

interface Props {
    item: DailyAttendance;
    mode?: 'students' | 'teachers';
}

export function AttendanceDetailsDialog({ item,
    mode = 'students', }: Props) {
    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                >
                    <Eye className="size-4" />
                    Batafsil
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                />

                <Dialog.Content
                    className="
            fixed left-1/2 top-1/2 z-50
            max-h-[90dvh]
            w-[calc(100vw-2rem)]
            max-w-4xl
            -translate-x-1/2 -translate-y-1/2
            overflow-y-auto
            rounded-2xl border border-border
            bg-background p-4 shadow-2xl
            outline-none sm:p-6
          "
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <Dialog.Title className="text-xl font-bold">
                                {mode === 'teachers'
                                    ? 'O‘qituvchi davomati'
                                    : 'O‘quvchi davomati'}
                            </Dialog.Title>

                            <Dialog.Description className="text-sm text-muted-foreground">
                                Davomat sanasi: {item.date}
                            </Dialog.Description>
                        </div>

                        <Dialog.Close asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Yopish"
                                title="Yopish"
                            >
                                <X className="size-5" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <AttendanceCard item={item} />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
