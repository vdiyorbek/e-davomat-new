import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
    label: string;
    placeholder: string;
    initialValue: string;
    onSearch: (value: string) => void;
    className?: string;
}

/**
 * Filtr panelidagi qidiruv: label + maydon + «Qidirish» tugmasi.
 * URL’dagi qiymat o‘zgarsa, `key` orqali qayta yaratiladi.
 */
export function FilterSearchForm({ label, placeholder, initialValue, onSearch, className }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [value, setValue] = useState(initialValue);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(value.trim().replace(/\s+/g, ' '));
    }

    return (
        <form onSubmit={handleSubmit} role="search" className={cn('min-w-0', className)}>
            <Field htmlFor={id} label={label}>
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            id={id}
                            type="search"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            maxLength={100}
                            placeholder={placeholder}
                            className="pl-10"
                        />
                    </div>
                    <Button type="submit" className="h-11 shrink-0">
                        <Search aria-hidden="true" className="sm:hidden" />
                        <span className="max-sm:sr-only">{t('common.search')}</span>
                    </Button>
                </div>
            </Field>
        </form>
    );
}