import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useApiQuery } from '@/hooks/useApiQuery';

import type { School } from '@/types/school';

interface FilterOption {
    id: number;
    name: string;
}

interface FilterSelectProps {
    label: string;
    value: string;
    placeholder: string;
    options: FilterOption[];
    disabled?: boolean;
    onChange: (value: string) => void;
}

function FilterSelect({
    label,
    value,
    placeholder,
    options,
    disabled,
    onChange,
}: FilterSelectProps) {
    const id = useId();

    const selectedExists =
        !value || options.some((item) => String(item.id) === value);

    return (
        <div className="min-w-0 space-y-2">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>

            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
                <option value="">{placeholder}</option>

                {!selectedExists && (
                    <option value={value} disabled>
                        Tanlangan qiymat ro‘yxatda yo‘q
                    </option>
                )}

                {options.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

function uniqueOptions(items: FilterOption[]): FilterOption[] {
    return Array.from(
        new Map(items.map((item) => [item.id, item])).values(),
    ).sort((a, b) => a.name.localeCompare(b.name));
}

function SearchForm({
    initialValue,
    onSearch,
}: {
    initialValue: string;
    onSearch: (value: string) => void;
}) {
    const id = useId();
    const [value, setValue] = useState(initialValue);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(value.trim().replace(/\s+/g, ' '));
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor={id} className="text-sm font-medium">
                Qidiruv
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    id={id}
                    type="search"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    maxLength={100}
                    placeholder="Ism, familiya yoki PNFL"
                    className="h-10 min-w-0 flex-1"
                />

                <Button type="submit" className="h-10">
                    Qidirish
                </Button>
            </div>
        </form>
    );
}

export function SchoolMembersFilters() {
    const { session } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const {
        data: schools,
        loading,
        error,
        retry,
    } = useApiQuery<School[]>('/schools');

    const role = session?.profile.role;

    const regionId = searchParams.get('regionId') ?? '';
    const districtId = searchParams.get('districtId') ?? '';
    const schoolId = searchParams.get('schoolId') ?? '';
    const search = searchParams.get('q') ?? '';
    const status = searchParams.get('status') ?? '';
    const statusId = useId();
    const canSelectRegion = role === 'SUPER_ADMIN';

    const canSelectDistrict =
        role === 'SUPER_ADMIN' || role === 'REGION_ADMIN';

    const canSelectSchool =
        role === 'SUPER_ADMIN' ||
        role === 'REGION_ADMIN' ||
        role === 'DISTRICT_ADMIN';

    const schoolList = schools ?? [];

    const regions = uniqueOptions(
        schoolList.map((school) => school.district.region),
    );

    const schoolsInRegion = schoolList.filter(
        (school) =>
            !regionId ||
            String(school.district.region.id) === regionId,
    );

    const districts = uniqueOptions(
        schoolsInRegion.map((school) => school.district),
    );

    const availableSchools = schoolsInRegion.filter(
        (school) =>
            !districtId ||
            String(school.districtId) === districtId,
    );

    function changeFilter(
        name: 'regionId' | 'districtId' | 'schoolId' | 'q' | 'status',
        value: string,
    ) {
        const next = new URLSearchParams(searchParams);

        if (value) {
            next.set(name, value);
        } else {
            next.delete(name);
        }

        if (name === 'regionId') {
            next.delete('districtId');
            next.delete('schoolId');
        }

        if (name === 'districtId') {
            next.delete('schoolId');
        }

        next.set('page', '1');
        setSearchParams(next);
    }

    function clearFilters() {
        const next = new URLSearchParams(searchParams);

        next.delete('regionId');
        next.delete('districtId');
        next.delete('schoolId');
        next.delete('q');
        next.delete('status');
        next.set('page', '1');


        setSearchParams(next);
    }

    const hasFilters = Boolean(
        regionId || districtId || schoolId || search || status,
    );

    return (
        <section
            aria-label="Ro‘yxat filtrlari"
            className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground sm:p-5"
        >
            <SearchForm
                key={searchParams.toString()}
                initialValue={search}
                onSearch={(value) => changeFilter('q', value)}
            />
            <div className="max-w-sm space-y-2">
                <label htmlFor={statusId} className="text-sm font-medium">
                    Faoliyat holati
                </label>

                <select
                    id={statusId}
                    value={status}
                    onChange={(event) =>
                        changeFilter('status', event.target.value)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                    <option value="">Barchasi</option>
                    <option value="ACTIVE">Faol</option>
                    <option value="ENDED">Yakunlangan</option>
                    <option value="PLANNED">Rejalashtirilgan</option>
                </select>
            </div>
            {canSelectSchool && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {canSelectRegion && (
                        <FilterSelect
                            label="Viloyat"
                            value={regionId}
                            placeholder="Barcha viloyatlar"
                            options={regions}
                            disabled={loading || Boolean(error)}
                            onChange={(value) =>
                                changeFilter('regionId', value)
                            }
                        />
                    )}

                    {canSelectDistrict && (
                        <FilterSelect
                            label="Tuman / shahar"
                            value={districtId}
                            placeholder="Barcha tuman va shaharlar"
                            options={districts}
                            disabled={loading || Boolean(error)}
                            onChange={(value) =>
                                changeFilter('districtId', value)
                            }
                        />
                    )}

                    <FilterSelect
                        label="Maktab"
                        value={schoolId}
                        placeholder="Barcha ruxsat berilgan maktablar"
                        options={availableSchools}
                        disabled={loading || Boolean(error)}
                        onChange={(value) =>
                            changeFilter('schoolId', value)
                        }
                    />
                </div>
            )}

            {loading && canSelectSchool && (
                <p role="status" className="text-sm text-muted-foreground">
                    Filtr variantlari yuklanmoqda…
                </p>
            )}

            {error && canSelectSchool && (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={retry}
                    >
                        Qayta urinish
                    </Button>
                </div>
            )}

            {hasFilters && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                >
                    Filtrlarni tozalash
                </Button>
            )}
        </section>
    );
}