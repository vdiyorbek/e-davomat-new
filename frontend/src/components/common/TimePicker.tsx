import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

interface TimePickerProps {
    id?: string;
    /** `HH:mm` yoki bo‘sh qator. */
    value: string;
    /** `<TimePicker>` bilan bir xil imzo: `event.target.value`. */
    onChange: (event: { target: { value: string } }) => void;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    'aria-label'?: string;
}

function Column({ items, current, label, onPick }: { items: string[]; current: string; label: string; onPick: (v: string) => void }) {
    return (
        <ScrollArea className="h-56 w-16" aria-label={label}>
            <div className="flex flex-col gap-0.5 p-1">
                {items.map((item) => (
                    <Button
                        key={item}
                        type="button"
                        variant={item === current ? 'default' : 'ghost'}
                        size="sm"
                        className="w-full tabular-nums"
                        ref={(node) => {
                            if (node && item === current) node.scrollIntoView({ block: 'center' });
                        }}
                        onClick={() => onPick(item)}
                    >
                        {item}
                    </Button>
                ))}
            </div>
        </ScrollArea>
    );
}

/** shadcn Popover asosidagi vaqt tanlagich (`<input type="time">` o‘rniga). */
export function TimePicker({ id, value, onChange, disabled, required, className, ...aria }: TimePickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [hh = '', mm = ''] = /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5).split(':') : [];
    const emit = (h: string, m: string) => onChange({ target: { value: `${h || '00'}:${m || '00'}` } });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="relative">
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        data-empty={!hh || undefined}
                        className={cn(
                            'h-11 w-full min-w-0 justify-start gap-2 rounded-xl bg-card px-3.5 text-left font-normal tabular-nums md:text-sm dark:bg-input/30',
                            'data-[empty]:text-muted-foreground',
                            className,
                        )}
                        {...aria}
                    >
                        <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        {hh ? `${hh}:${mm}` : t('common.pickTime')}
                    </Button>
                </PopoverTrigger>
                {required && (
                    <input tabIndex={-1} aria-hidden="true" required readOnly value={value} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
                )}
            </div>
            <PopoverContent align="start" className="w-auto p-2">
                <div className="flex gap-1">
                    <Column items={HOURS} current={hh} label={t('common.hours')} onPick={(h) => emit(h, mm)} />
                    <Column items={MINUTES} current={mm} label={t('common.minutes')} onPick={(m) => { emit(hh, m); setOpen(false); }} />
                </div>
            </PopoverContent>
        </Popover>
    );
}
