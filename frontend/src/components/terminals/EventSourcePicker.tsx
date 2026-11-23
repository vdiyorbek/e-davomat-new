import { useId } from 'react';
import { RadioTower, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { TerminalEventSource } from '@/types/terminal';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const OPTIONS = [
    { value: 'PUSH', icon: RadioTower },
    { value: 'POLLING', icon: RefreshCw },
] as const;

/** Terminal eventlarini olish usuli: HTTP Push yoki polling. */
export function EventSourcePicker({
    value,
    onChange,
    disabled,
}: {
    value: TerminalEventSource;
    onChange: (value: TerminalEventSource) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const name = useId();

    return (
        <fieldset className="space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium">{t('terminals.eventSource.label')}</legend>
            <RadioGroup
                name={name}
                value={value}
                onValueChange={(next) => onChange(next as TerminalEventSource)}
                disabled={disabled}
                className="sm:grid-cols-2"
            >
                {OPTIONS.map(({ value: option, icon: Icon }) => (
                    <Label
                        key={option}
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                            value === option ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                            disabled && 'cursor-not-allowed opacity-60',
                        )}
                    >
                        <RadioGroupItem value={option} className="mt-1" />
                        <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-semibold">
                                <Icon aria-hidden="true" className="size-4" />
                                {t(`terminals.eventSource.${option}`)}
                                {option === 'PUSH' && (
                                    <span className="rounded-full bg-success/15 px-1.5 text-[11px] font-medium text-success">
                                        {t('terminals.eventSource.recommended')}
                                    </span>
                                )}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{t(`terminals.eventSource.hints.${option}`)}</span>
                        </span>
                    </Label>
                ))}
            </RadioGroup>
        </fieldset>
    );
}
