import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectOption {
    value: string;
    label: ReactNode;
    /** Qidiruv uchun matn (label ReactNode bo‘lsa kerak bo‘ladi). */
    keywords?: string;
    disabled?: boolean;
}

interface SelectFieldProps {
    id?: string;
    name?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    /** Bo‘sh qiymat ('') uchun ko‘rsatiladigan variant, masalan «Barcha maktablar». */
    emptyOption?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    className?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    /**
     * Qidiruvli ro‘yxat. Standart holatda 12 tadan ko‘p variant bo‘lsa yoqiladi.
     */
    searchable?: boolean;
}

// Radix Select '' qiymatni qabul qilmaydi, shuning uchun ichki belgi ishlatamiz.
const EMPTY = '__all__';

/**
 * shadcn/ui Select ustidagi yagona tanlash maydoni.
 * Uzun ro‘yxatlar avtomatik ravishda qidiruvli (Command) ko‘rinishga o‘tadi.
 */
export function SelectField({
    id,
    name,
    value,
    onValueChange,
    options,
    emptyOption,
    placeholder,
    disabled,
    required,
    invalid,
    className,
    searchable,
    ...aria
}: SelectFieldProps) {
    const useSearch = searchable ?? options.length > 12;

    if (useSearch) {
        return (
            <ComboboxField
                id={id}
                name={name}
                value={value}
                onValueChange={onValueChange}
                options={options}
                emptyOption={emptyOption}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                invalid={invalid}
                className={className}
                {...aria}
            />
        );
    }

    const radixValue = value === '' ? (emptyOption !== undefined ? EMPTY : '') : value;

    return (
        <Select
            name={name}
            value={radixValue}
            onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
            disabled={disabled}
            required={required}
        >
            <SelectTrigger
                id={id}
                aria-invalid={invalid || undefined}
                aria-label={aria['aria-label']}
                aria-describedby={aria['aria-describedby']}
                className={cn('w-full min-w-0', className)}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-80">
                {emptyOption !== undefined && (
                    <SelectItem value={EMPTY}>{emptyOption}</SelectItem>
                )}
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function ComboboxField({
    id,
    name,
    value,
    onValueChange,
    options,
    emptyOption,
    placeholder,
    disabled,
    required,
    invalid,
    className,
    ...aria
}: Omit<SelectFieldProps, 'searchable'>) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const selected = options.find((option) => option.value === value);
    const display =
        selected?.label ??
        (value === '' && emptyOption !== undefined ? emptyOption : undefined);

    function choose(next: string) {
        onValueChange(next);
        setOpen(false);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    aria-required={required || undefined}
                    disabled={disabled}
                    className={cn(
                        'h-11 w-full min-w-0 justify-between rounded-xl bg-card px-3.5 text-base font-normal md:text-sm dark:bg-input/30',
                        display === undefined && 'text-muted-foreground',
                        className,
                    )}
                    {...aria}
                >
                    <span className="truncate">{display ?? placeholder}</span>
                    <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            {name && <input type="hidden" name={name} value={value} />}
            <PopoverContent
                className="w-(--radix-popover-trigger-width) min-w-64 p-0"
                align="start"
            >
                <Command>
                    <CommandInput placeholder={t('common.searchPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>{t('common.nothingFound')}</CommandEmpty>
                        <CommandGroup>
                            {emptyOption !== undefined && (
                                <CommandItem
                                    value={`${EMPTY} ${emptyOption}`}
                                    onSelect={() => choose('')}
                                >
                                    <Check
                                        aria-hidden="true"
                                        className={cn('size-4', value === '' ? 'opacity-100' : 'opacity-0')}
                                    />
                                    {emptyOption}
                                </CommandItem>
                            )}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={`${option.value} ${option.keywords ?? (typeof option.label === 'string' ? option.label : '')}`}
                                    disabled={option.disabled}
                                    onSelect={() => choose(option.value)}
                                >
                                    <Check
                                        aria-hidden="true"
                                        className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
