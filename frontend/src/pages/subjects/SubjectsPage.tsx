import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { BookMarked, Plus, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPost } from '@/lib/auth-session';

import { SubjectFields } from './subject-form';
import type { Subject, SubjectValues } from './subject-form';
import { validateSubject } from './subject-validation';
import { SubjectActions } from './SubjectRow';

const EMPTY: SubjectValues = { code: '', nameUz: '', nameRu: '' };

export function SubjectsPage() {
    const { t } = useTranslation();
    const id = useId();
    const query = useApiQuery<Subject[]>('/subjects');
    const [values, setValues] = useState<SubjectValues>(EMPTY);
    const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const subjects = query.data ?? [];
    const visible = subjects.filter((subject) => (filter === 'all' ? true : filter === 'active' ? subject.isActive : !subject.isActive));

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        setSuccess('');
        const invalid = validateSubject(values);
        if (invalid) return setError(t(invalid));

        setBusy(true);
        try {
            const nameUz = values.nameUz.trim();
            await authorizedPost<Subject>('/subjects', {
                code: values.code.trim().toUpperCase(),
                nameUz,
                ...(values.nameRu.trim() ? { nameRu: values.nameRu.trim() } : {}),
            });
            setSuccess(t('subjects.created', { name: nameUz }));
            setValues(EMPTY);
            query.retry();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('subjects.errors.createFailed'));
        } finally {
            setBusy(false);
        }
    }

    function statusBadge(subject: Subject) {
        return (
            <StatusBadge tone={subject.isActive ? 'success' : 'neutral'}>
                {subject.isActive ? t('subjects.status.active') : t('subjects.status.archived')}
            </StatusBadge>
        );
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('subjects.title')} description={t('subjects.subtitle')} />

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">{t('subjects.createTitle')}</CardTitle>
                    <CardDescription>{t('subjects.createHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
                        <SubjectFields idPrefix={id} values={values} onChange={setValues} disabled={busy} />
                        {error && <ErrorState message={error} />}
                        {success && <SuccessNotice>{success}</SuccessNotice>}
                        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                            <Plus aria-hidden="true" />
                            {busy ? t('common.saving') : t('subjects.add')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="font-heading text-lg font-semibold">{t('subjects.listTitle')}</h2>
                        <p className="text-sm text-muted-foreground">{t('common.total', { count: visible.length })}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                            <TabsList>
                                <TabsTrigger value="active">{t('subjects.active')}</TabsTrigger>
                                <TabsTrigger value="archived">{t('subjects.archived')}</TabsTrigger>
                                <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button type="button" variant="outline" size="icon" className="bg-card" aria-label={t('common.refresh')} onClick={query.retry} disabled={query.loading}>
                            <RotateCw aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                {query.loading ? (
                    <LoadingState rows={5} />
                ) : query.error ? (
                    <ErrorState message={query.error} onRetry={query.retry} />
                ) : visible.length === 0 ? (
                    <EmptyState icon={BookMarked} title={t('subjects.emptyTitle')} description={t('subjects.empty')} />
                ) : (
                    <>
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {visible.map((subject) => (
                                <li key={subject.id}>
                                    <Card size="sm" className="h-full gap-3 px-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold [overflow-wrap:anywhere]">{subject.nameUz}</p>
                                            {statusBadge(subject)}
                                        </div>
                                        <DetailList>
                                            <DetailItem label={t('subjects.code')}>
                                                <span className="font-mono text-xs">{subject.code}</span>
                                            </DetailItem>
                                            <DetailItem label={t('subjects.nameRu')}>{subject.nameRu ?? '—'}</DetailItem>
                                        </DetailList>
                                        <div className="mt-auto border-t pt-3">
                                            <SubjectActions subject={subject} onUpdated={query.retry} />
                                        </div>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                        <Card className="hidden py-0 xl:flex">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                                        <TableHead>{t('subjects.code')}</TableHead>
                                        <TableHead>{t('subjects.nameUz')}</TableHead>
                                        <TableHead>{t('subjects.nameRu')}</TableHead>
                                        <TableHead>{t('common.status')}</TableHead>
                                        <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.map((subject, index) => (
                                        <TableRow key={subject.id}>
                                            <TableCell className="pl-5 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs">{subject.code}</TableCell>
                                            <TableCell className="font-semibold">{subject.nameUz}</TableCell>
                                            <TableCell>{subject.nameRu ?? '—'}</TableCell>
                                            <TableCell>{statusBadge(subject)}</TableCell>
                                            <TableCell className="pr-5">
                                                <SubjectActions subject={subject} onUpdated={query.retry} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                )}
            </section>
        </div>
    );
}
