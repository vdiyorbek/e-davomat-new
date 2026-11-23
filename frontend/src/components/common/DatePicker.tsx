import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Locale } from 'date-fns';
import { enUS, kk, ru, uz, uzCyrl } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseIsoDate, toIsoDate } from '@/lib/date';
import { cn } from '@/lib/utils';

// ky va tg uchun date-fns lokali yo‘q; oy va hafta kunlari nomlari formatters orqali i18n dan olinadi.
const LOCALES: Record<string, Locale> = { uz, 'uz-Cyrl': uzCyrl, ru, en: enUS, kk, ky: ru, tg: ru };

interface DatePickerProps {
    id?: string;
    name?: string;
    /** `YYYY-MM-DD` yoki bo‘sh qator. */
    value: string;
    /** `<DatePicker>` bilan bir xil imzo: `event.target.value`. */
    onChange: (event: { target: { value: string } }) => void;
    min?: string;
    max?: string;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    /** Tozalash tugmasini ko‘rsatadi (majburiy bo‘lmagan maydonlar uchun). */
    clearable?: boolean;
    className?: string;
    autoFocus?: boolean;
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

/**
 * shadcn Calendar + Popover asosidagi sana tanlagich.
 * Brauzerning `<input type="date">` oynasi o‘rniga: til, dark mode va dizayn bir xil.
 */
export function DatePicker({
    id,
    name,
    value,
    onChange,
    min,
    max,
    disabled,
    required,
    placeholder,
    clearable,
    className,
    autoFocus,
    ...aria
}: DatePickerProps) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const locale = LOCALES[i18n.resolvedLanguage ?? 'uz'] ?? uz;
    const selected = parseIsoDate(value);
    const minDate = parseIsoDate(min);
    const maxDate = parseIsoDate(max);
    const startYear = (minDate ?? new Date(new Date().getFullYear() - 100, 0)).getFullYear();
    const endYear = (maxDate ?? new Date(new Date().getFullYear() + 5, 11)).getFullYear();
    const disabledDays: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) disabledDays.push({ before: minDate });
    if (maxDate) disabledDays.push({ after: maxDate });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="relative">
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        autoFocus={autoFocus}
                        data-empty={!selected || undefined}
                        className={cn(
                            'h-11 w-full min-w-0 justify-start gap-2 rounded-xl bg-card px-3.5 text-left font-normal tabular-nums md:text-sm dark:bg-input/30',
                            'data-[empty]:text-muted-foreground',
                            clearable && selected && 'pr-10',
                            className,
                        )}
                        {...aria}
                    >
                        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                            {selected ? format(selected, 'dd.MM.yyyy') : (placeholder ?? t('common.pickDate'))}
                        </span>
                    </Button>
                </PopoverTrigger>
                {clearable && selected && !disabled && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('common.clear')}
                        className="absolute top-1/2 right-2 -translate-y-1/2"
                        onClick={() => onChange({ target: { value: '' } })}
                    >
                        <X aria-hidden="true" />
                    </Button>
                )}
                {required && (
                    <input
                        tabIndex={-1}
                        aria-hidden="true"
                        required
                        readOnly
                        name={name}
                        value={value}
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
                    />
                )}
            </div>
            <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                    mode="single"
                    locale={locale}
                    formatters={{
                        formatMonthDropdown: (month) => t(`date.months.${month.getMonth() + 1}`),
                        // date.weekdays.short: 0 = dushanba … 6 = yakshanba
                        formatWeekdayName: (weekday) => t(`date.weekdays.short.${(weekday.getDay() + 6) % 7}`),
                    }}
                    selected={selected}
                    defaultMonth={selected ?? maxDate ?? new Date()}
                    captionLayout="dropdown"
                    startMonth={new Date(startYear, 0)}
                    endMonth={new Date(endYear, 11)}
                    disabled={disabledDays}
                    onSelect={(date) => {
                        if (!date) return;
                        onChange({ target: { value: toIsoDate(date) } });
                        setOpen(false);
                    }}
                />
                <div className="flex items-center justify-between border-t px-3 py-2">
                    <Button
                        type="button"
                        variant="link"
                        size="auto"
                        className="text-xs"
                        onClick={() => {
                            const today = new Date();
                            if ((minDate && today < minDate) || (maxDate && today > maxDate)) return;
                            onChange({ target: { value: toIsoDate(today) } });
                            setOpen(false);
                        }}
                    >
                        {t('common.today')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
