import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HomeroomGuardian } from '@/types/homeroom';

/** Ota-ona telefon raqamlari: bosilganda qo‘ng‘iroq qilinadi. */
export function GuardianLinks({ guardians }: { guardians: HomeroomGuardian[] }) {
    const { t } = useTranslation();
    const withPhone = guardians.filter((g) => g.phoneNumber);

    if (withPhone.length === 0) {
        return <span className="text-xs text-muted-foreground">{t('homeroom.noPhone')}</span>;
    }

    return (
        <ul className="space-y-1">
            {withPhone.map((g) => (
                <li key={g.relation} className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="text-xs text-muted-foreground">{t(`persons.guardians.${g.relation === 'FATHER' ? 'father' : 'mother'}`)}</span>
                    <a
                        href={`tel:${g.phoneNumber}`}
                        className="inline-flex items-center gap-1 font-medium tabular-nums underline-offset-4 hover:text-primary hover:underline"
                    >
                        <Phone aria-hidden="true" className="size-3.5" />
                        {g.phoneNumber}
                    </a>
                    {g.name && <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{g.name}</span>}
                </li>
            ))}
        </ul>
    );
}
