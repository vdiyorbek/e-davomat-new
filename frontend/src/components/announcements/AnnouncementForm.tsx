import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { DatePicker } from '@/components/common/DatePicker';
import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { authorizedPost } from '@/lib/auth-session';
import { todayInTashkent } from '@/lib/date';
import { schoolScopeOptions } from '@/lib/school-scope';
import type { School } from '@/types/school';
import type { AnnouncementKind, AnnouncementScope, RecipientRole } from '@/types/announcement';

const KINDS: AnnouncementKind[] = ['INFO', 'TASK', 'URGENT'];
const ALL_ROLES: RecipientRole[] = ['REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'MAHALLA_INSPECTOR'];

/** Yangi xabar / topshiriq yuborish formasi. Viloyat administratori faqat o‘z viloyatiga yoza oladi. */
export function AnnouncementForm({ onCancel, onSent }: { onCancel: () => void; onSent: (count: number) => void }) {
    const { t } = useTranslation();
    const { session } = useAuth();
    const isSuper = session?.profile.role === 'SUPER_ADMIN';

    const schools = useApiQuery<School[]>('/schools');

    const [kind, setKind] = useState<AnnouncementKind>('INFO');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [scope, setScope] = useState<AnnouncementScope>(isSuper ? 'ALL' : 'REGION');
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const [schoolSearch, setSchoolSearch] = useState('');
    const [roles, setRoles] = useState<Set<RecipientRole>>(new Set(['SCHOOL_ADMIN']));
    const [linkPath, setLinkPath] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const options = schoolScopeOptions(schools.data, regionId, districtId);
    const visibleSchools = useMemo(() => {
        const needle = schoolSearch.trim().toLocaleLowerCase();
        return options.schools.filter((school) => !needle || (school.keywords ?? school.label).toLocaleLowerCase().includes(needle));
    }, [options.schools, schoolSearch]);

    const scopeOptions = (isSuper ? (['ALL', 'REGION', 'DISTRICT', 'SCHOOLS'] as const) : (['REGION', 'DISTRICT', 'SCHOOLS'] as const)).map((value) => ({
        value,
        label: t(`announcements.scopes.${value}`),
    }));
    const roleList = isSuper ? ALL_ROLES : ALL_ROLES.filter((role) => role !== 'REGION_ADMIN');

    function toggleRole(role: RecipientRole, checked: boolean) {
        setRoles((current) => {
            const next = new Set(current);
            if (checked) next.add(role);
            else next.delete(role);
            return next;
        });
    }

    function toggleSchool(id: number, checked: boolean) {
        setPicked((current) => {
            const next = new Set(current);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function pickVisible(all: boolean) {
        setPicked((current) => {
            const next = new Set(current);
            for (const school of visibleSchools) {
                if (all) next.add(Number(school.value));
                else next.delete(Number(school.value));
            }
            return next;
        });
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');

        if (scope === 'REGION' && isSuper && !regionId) return setError(t('announcements.errors.region'));
        if (scope === 'DISTRICT' && !districtId) return setError(t('announcements.errors.district'));
        if (scope === 'SCHOOLS' && picked.size === 0) return setError(t('announcements.errors.schools'));
        if (roles.size === 0) return setError(t('announcements.errors.roles'));

        setBusy(true);
        try {
            const result = await authorizedPost<{ recipients: number }>('/announcements', {
                kind,
                title: title.trim(),
                body: body.trim(),
                scope,
                ...(scope === 'REGION' && isSuper ? { regionId: Number(regionId) } : {}),
                ...(scope === 'DISTRICT' ? { districtId: Number(districtId) } : {}),
                ...(scope === 'SCHOOLS' ? { schoolIds: [...picked] } : {}),
                roles: [...roles],
                ...(linkPath.trim() ? { linkPath: linkPath.trim() } : {}),
                ...(kind === 'TASK' && dueDate ? { dueDate } : {}),
            });
            onSent(result.recipients);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('announcements.errors.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
                <div className="space-y-2">
                    <Label>{t('announcements.form.kind')}</Label>
                    <RadioGroup value={kind} onValueChange={(value) => setKind(value as AnnouncementKind)} className="grid gap-2 sm:grid-cols-3">
                        {KINDS.map((value) => (
                            <Label key={value} htmlFor={`kind-${value}`} className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                                <RadioGroupItem value={value} id={`kind-${value}`} className="mt-0.5" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{t(`announcements.kinds.${value}`)}</span>
                                    <span className="block text-xs font-normal text-muted-foreground">{t(`announcements.kindHints.${value}`)}</span>
                                </span>
                            </Label>
                        ))}
                    </RadioGroup>
                </div>

                <Field htmlFor="ann-title" label={t('announcements.form.title')}>
                    <Input id="ann-title" value={title} maxLength={150} required minLength={3} placeholder={t('announcements.form.titlePlaceholder')} onChange={(event) => setTitle(event.target.value)} />
                </Field>
                <Field htmlFor="ann-body" label={t('announcements.form.body')}>
                    <Textarea id="ann-body" value={body} maxLength={1000} required rows={4} placeholder={t('announcements.form.bodyPlaceholder')} onChange={(event) => setBody(event.target.value)} />
                </Field>

                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <h3 className="text-sm font-semibold">{t('announcements.form.audience')}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field htmlFor="ann-scope" label={t('announcements.form.scope')}>
                            <SelectField id="ann-scope" value={scope} onValueChange={(value) => setScope(value as AnnouncementScope)} options={scopeOptions} />
                        </Field>
                        {isSuper && (scope === 'REGION' || scope === 'DISTRICT' || scope === 'SCHOOLS') && (
                            <Field htmlFor="ann-region" label={t('announcements.form.region')}>
                                <SelectField
                                    id="ann-region"
                                    value={regionId}
                                    onValueChange={(value) => {
                                        setRegionId(value);
                                        setDistrictId('');
                                        setPicked(new Set());
                                    }}
                                    options={options.regions}
                                    emptyOption={t('announcements.form.any')}
                                />
                            </Field>
                        )}
                        {(scope === 'DISTRICT' || scope === 'SCHOOLS') && (
                            <Field htmlFor="ann-district" label={t('announcements.form.district')}>
                                <SelectField
                                    id="ann-district"
                                    value={districtId}
                                    onValueChange={(value) => setDistrictId(value)}
                                    options={options.districts}
                                    emptyOption={scope === 'SCHOOLS' ? t('announcements.form.any') : undefined}
                                />
                            </Field>
                        )}
                    </div>

                    {scope === 'SCHOOLS' && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input value={schoolSearch} onChange={(event) => setSchoolSearch(event.target.value)} placeholder={t('announcements.form.searchSchool')} aria-label={t('announcements.form.searchSchool')} className="min-w-0 flex-1" />
                                <Button type="button" size="sm" variant="outline" onClick={() => pickVisible(true)}>
                                    {t('announcements.form.selectAll')}
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => pickVisible(false)}>
                                    {t('announcements.form.clear')}
                                </Button>
                            </div>
                            <ul className="max-h-48 list-none divide-y overflow-y-auto rounded-lg border bg-card">
                                {visibleSchools.map((school) => {
                                    const id = Number(school.value);
                                    return (
                                        <li key={school.value}>
                                            <Label htmlFor={`school-${id}`} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm font-normal">
                                                <Checkbox id={`school-${id}`} checked={picked.has(id)} onCheckedChange={(checked) => toggleSchool(id, checked === true)} />
                                                <span className="min-w-0 [overflow-wrap:anywhere]">{school.label}</span>
                                            </Label>
                                        </li>
                                    );
                                })}
                            </ul>
                            <p className="text-xs text-muted-foreground">{t('announcements.form.selectedCount', { count: picked.size })}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>{t('announcements.form.roles')}</Label>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {roleList.map((role) => (
                                <Label key={role} htmlFor={`role-${role}`} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                    <Checkbox id={`role-${role}`} checked={roles.has(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)} />
                                    {t(`roles.${role}`)}
                                </Label>
                            ))}
                        </div>
                        {roles.has('MAHALLA_INSPECTOR') && scope === 'SCHOOLS' && (
                            <p className="text-xs text-muted-foreground">{t('announcements.form.inspectorHint')}</p>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor="ann-link" label={t('announcements.form.link')} hint={t('announcements.form.linkHint')}>
                        <Input id="ann-link" value={linkPath} maxLength={255} placeholder="/persons/123?edit=1" onChange={(event) => setLinkPath(event.target.value)} />
                    </Field>
                    {kind === 'TASK' && (
                        <Field htmlFor="ann-due" label={t('announcements.form.due')}>
                            <DatePicker id="ann-due" value={dueDate} min={todayInTashkent()} clearable onChange={(event) => setDueDate(event.target.value)} />
                        </Field>
                    )}
                </div>
            </fieldset>

            {error && <ErrorState message={error} />}

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={busy || schools.loading}>
                    {busy ? t('announcements.form.sending') : t('announcements.form.send')}
                </Button>
            </div>
        </form>
    );
}
