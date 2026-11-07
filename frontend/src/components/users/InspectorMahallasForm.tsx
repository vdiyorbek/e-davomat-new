import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/common/states';
import type { AccessUser } from '@/components/users/UserAccessForm';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { authorizedGet, authorizedPut } from '@/lib/auth-session';

const MAX_MAHALLAS = 30;

interface MahallaOption {
    id: number;
    name: string;
}

interface OptionsPage {
    data: MahallaOption[];
    totalPages: number;
}

interface Props {
    user: AccessUser;
    onUpdated: () => void;
    onCancel: () => void;
}

async function loadAllOptions(districtId: number, signal: AbortSignal) {
    const all: MahallaOption[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const res = await authorizedGet<OptionsPage>(
            `/mahallas/options?districtId=${districtId}&page=${page}&limit=100`,
            signal,
        );
        all.push(...res.data);
        totalPages = res.totalPages;
        page += 1;
    } while (page <= totalPages);

    return all;
}

export function InspectorMahallasForm({ user, onUpdated, onCancel }: Props) {
    const { t } = useTranslation();
    const districtId = user.scope.districtId;

    const [options, setOptions] = useState<MahallaOption[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(districtId !== null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (districtId === null) return;
        const controller = new AbortController();

        void Promise.all([
            loadAllOptions(districtId, controller.signal),
            authorizedGet<{ id: number }[]>(`/inspectors/${user.id}/mahallas`, controller.signal),
        ])
            .then(([all, assigned]) => {
                if (controller.signal.aborted) return;
                setOptions(all);
                setSelected(new Set(assigned.map((item) => item.id)));
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : t('common.loadFailed'));
                setLoading(false);
            });

        return () => controller.abort();
    }, [districtId, user.id, t]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return needle ? options.filter((item) => item.name.toLowerCase().includes(needle)) : options;
    }, [options, search]);

    function toggle(id: number, checked: boolean) {
        setError('');
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) {
                if (next.size >= MAX_MAHALLAS) {
                    setError(t('inspectors.mahallas.limit', { max: MAX_MAHALLAS }));
                    return prev;
                }
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    async function handleSave() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await authorizedPut(`/inspectors/${user.id}/mahallas`, { mahallaIds: [...selected] });
            onUpdated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common.loadFailed'));
        } finally {
            setBusy(false);
        }
    }

    if (districtId === null) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('inspectors.mahallas.noDistrict')}</p>
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.close')}
                </Button>
            </div>
        );
    }

    if (loading) return <LoadingState />;

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('inspectors.mahallas.hint', { max: MAX_MAHALLAS })}</p>

            <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('inspectors.mahallas.search')}
                aria-label={t('inspectors.mahallas.search')}
            />

            {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('inspectors.mahallas.empty')}</p>
            ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {visible.map((item) => (
                        <li key={item.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60">
                                <Checkbox
                                    checked={selected.has(item.id)}
                                    disabled={busy}
                                    onCheckedChange={(value) => toggle(item.id, value === true)}
                                />
                                <span className="min-w-0 [overflow-wrap:anywhere]">{item.name}</span>
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-xs text-muted-foreground">
                {t('inspectors.mahallas.selected', { count: selected.size, max: MAX_MAHALLAS })}
            </p>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                    {t('inspectors.mahallas.save')}
                </Button>
            </div>
        </div>
    );
}