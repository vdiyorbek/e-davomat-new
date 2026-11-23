import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { SelectField } from '@/components/common/SelectField';
import { AbsenceStreaks } from '@/components/dashboard/AbsenceStreaks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MIN_DAYS = ['', '7', '10', '15', '20', '30'];

/** Dashboarddagi «ketma-ket kelmaganlar» ro‘yxatining to‘liq ko‘rinishi: qidiruv va kun filtri bilan. */
export function AbsenceStreaksPage() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [minDays, setMinDays] = useState('');

    const scope = new URLSearchParams();
    for (const key of ['regionId', 'districtId', 'schoolId', 'date']) {
        const value = params.get(key);
        if (value) scope.set(key, value);
    }
    const back = `/dashboard?${scope.toString()}`;
    const filtered = new URLSearchParams(scope);
    if (search) filtered.set('search', search);
    if (minDays) filtered.set('minDays', minDays);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = searchInput.trim();
        if (value.length === 1) return;
        setSearch(value);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('dashboard.streaks.pageTitle')}
                description={t('dashboard.streaks.description')}
                actions={
                    <Button asChild variant="outline">
                        <Link to={back}>
                            <ArrowLeft aria-hidden="true" />
                            {t('dashboard.streaks.back')}
                        </Link>
                    </Button>
                }
            />
            <Card className="gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-end gap-3">
                    <form onSubmit={submit} className="flex min-w-0 flex-1 basis-64 gap-2">
                        <Input
                            value={searchInput}
                            onChange={(event) => {
                                setSearchInput(event.target.value);
                                if (event.target.value === '') setSearch('');
                            }}
                            placeholder={t('dashboard.streaks.search')}
                            aria-label={t('dashboard.streaks.search')}
                            maxLength={60}
                        />
                        <Button type="submit" variant="secondary" size="icon" aria-label={t('dashboard.streaks.search')}>
                            <Search aria-hidden="true" />
                        </Button>
                    </form>
                    <div className="w-44">
                        <SelectField
                            value={minDays}
                            onValueChange={setMinDays}
                            aria-label={t('dashboard.streaks.minDays')}
                            emptyOption={t('dashboard.streaks.minDaysAny')}
                            options={MIN_DAYS.filter(Boolean).map((value) => ({
                                value,
                                label: t('dashboard.streaks.minDaysN', { count: Number(value) }),
                            }))}
                        />
                    </div>
                </div>
                <AbsenceStreaks key={filtered.toString()} scopeQuery={filtered.toString()} level="COUNTRY" limit={20} />
            </Card>
        </div>
    );
}
