
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { FileCheck2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AttendanceExcuseForm } from './AttendanceExcuseForm';

import type { DailyAttendance } from '@/types/daily-attendance';

interface Props {
    item: DailyAttendance;
    onSaved: () => void;
}

export function AttendanceExcuseDialog({
    item,
    onSaved,
}: Props) {
    const [open, setOpen] = useState(false);

    function handleSaved() {
        setOpen(false);
        onSaved();
    }

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                >
                    <FileCheck2 className="size-4" />
                    Sababli qilish
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
            max-w-2xl
            -translate-x-1/2 -translate-y-1/2
            overflow-y-auto
            rounded-2xl border border-border
            bg-background p-5 shadow-2xl
            outline-none sm:p-6
          "
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <Dialog.Title className="text-xl font-bold">
                                O‘quvchini sababli belgilash
                            </Dialog.Title>

                            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                                Sabab turini, sana oralig‘ini va asoslovchi
                                PDF hujjatni kiriting.
                            </Dialog.Description>
                        </div>

                        <Dialog.Close asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Yopish"
                            >
                                <X className="size-5" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {open && (
                        <AttendanceExcuseForm
                            item={item}
                            onSaved={handleSaved}
                            onCancel={() => setOpen(false)}
                        />
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
