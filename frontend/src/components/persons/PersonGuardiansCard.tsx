import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Guardian, Guardians } from '@/types/person';

import { fullGuardianName } from './guardians';

function Row({ label, guardian }: { label: string; guardian: Guardian | null }) {
    const { t } = useTranslation();
    const name = fullGuardianName(guardian);
    const phone = guardian?.phoneNumber ?? null;
    const empty = !name && !phone;

    return (
        <div className="min-w-0 rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            {empty ? (
                <p className="mt-1 text-sm text-muted-foreground">{t('persons.guardians.notSet')}</p>
            ) : (
                <>
                    <p className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">{name || t('persons.guardians.nameNotSet')}</p>
                    {phone && (
                        <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary tabular-nums hover:underline">
                            <Phone aria-hidden="true" className="size-3.5" />
                            {phone}
                        </a>
                    )}
                </>
            )}
        </div>
    );
}

/** O‘quvchi sahifasida ota-ona ma’lumoti (faqat o‘qish). Ruxsat bo‘lmasa yoki xato bo‘lsa ko‘rsatilmaydi. */
export function PersonGuardiansCard({ personId }: { personId: number }) {
    const { t } = useTranslation();
    const query = useApiQuery<Guardians>(`/persons/${personId}/guardians`);

    if (query.error) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold">{t('persons.guardians.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                {query.loading ? (
                    <Skeleton className="h-20 w-full rounded-xl" />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Row label={t('persons.guardians.father')} guardian={query.data?.father ?? null} />
                        <Row label={t('persons.guardians.mother')} guardian={query.data?.mother ?? null} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
