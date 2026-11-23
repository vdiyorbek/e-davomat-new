import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { fullGuardianName } from '@/components/persons/guardians';
import type { Guardian, Guardians } from '@/types/person';

function Line({ label, guardian }: { label: string; guardian: Guardian | null | undefined }) {
    const name = fullGuardianName(guardian ?? null);
    const phone = guardian?.phoneNumber ?? null;
    if (!name && !phone) return null;

    return (
        <div className="text-xs leading-5">
            <p className="[overflow-wrap:anywhere]">
                <span className="text-muted-foreground">{label}: </span>
                {name ? <span className="font-medium">{name}</span> : null}
            </p>
            {phone && (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary tabular-nums hover:underline">
                    <Phone aria-hidden="true" className="size-3" />
                    {phone}
                </a>
            )}
        </div>
    );
}

/** Ota va onaning F.I.Sh. va telefoni (bosib qo‘ng‘iroq qilinadi). Ma’lumot bo‘lmasa «kiritilmagan». */
export function GuardianContacts({ guardians }: { guardians?: Guardians }) {
    const { t } = useTranslation();
    const hasAny = Boolean(guardians?.father || guardians?.mother);

    if (!hasAny) {
        return <span className="text-xs text-muted-foreground">{t('persons.guardians.notSet')}</span>;
    }

    return (
        <div className="space-y-2">
            <Line label={t('persons.guardians.father')} guardian={guardians?.father} />
            <Line label={t('persons.guardians.mother')} guardian={guardians?.mother} />
        </div>
    );
}
