import { useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MembershipDetailsForm } from './MembershipDetailsForm';

import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SchoolMembersFilters } from '@/components/memberships/SchoolMembersFilters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, todayInTashkent } from '@/lib/date';
import { personFullName } from '@/lib/person';
import type { SchoolMembership, SchoolMembershipsPage } from '@/types/school-membership';
import { MemberAccountForm } from './MemberAccountForm';
import { ChangeClassForm } from './ChangeClassForm';
import { CreateMemberForm } from './CreateMemberForm';
import { EndMembershipForm } from './EndMembershipForm';
import { SchoolMemberActions } from './SchoolMemberActions';
import { TransferSchoolForm } from './TransferSchoolForm';

type MembershipType = 'STUDENT' | 'TEACHER';

interface SchoolMembersPageProps {
    type: MembershipType;
}

function membershipState(item: SchoolMembership): 'ACTIVE' | 'ENDED' | 'PLANNED' {
    const today = todayInTashkent();
    if (item.startDate > today) return 'PLANNED';
    if (item.endDate && item.endDate <= today) return 'ENDED';
    return 'ACTIVE';
}

const STATE_TONE = { ACTIVE: 'success', ENDED: 'neutral', PLANNED: 'info' } as const;

function PersonLink({ item }: { item: SchoolMembership }) {
    const { t } = useTranslation();
    if (!item.person) return <span className="text-muted-foreground">{t('common.personMissing')}</span>;
    return (
        <Link
            to={`/persons/${item.person.id}`}
            className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:underline"
        >
            {personFullName(item.person)}
        </Link>
    );
}

interface MembersResultsProps {
    path: string;
    type: MembershipType;
    onPageChange: (page: number) => void;
}

function MembersResults({ path, type, onPageChange }: MembersResultsProps) {
    const { t } = useTranslation();
    const kind = type === 'STUDENT' ? 'students' : 'teachers';
    const { data, loading, error, retry } = useApiQuery<SchoolMembershipsPage>(path);
    const { session } = useAuth();

    const [ending, setEnding] = useState<SchoolMembership | null>(null);
    const [changingClass, setChangingClass] = useState<SchoolMembership | null>(null);
    const [transferring, setTransferring] = useState<SchoolMembership | null>(null);
    const [detailsMember, setDetailsMember] =
        useState<SchoolMembership | null>(null);
    const [success, setSuccess] = useState('');
    const [accountMember, setAccountMember] =
        useState<SchoolMembership | null>(null);
    const role = session?.profile.role;
    const canManageAccounts = [
        'SUPER_ADMIN',
        'REGION_ADMIN',
        'DISTRICT_ADMIN',
        'SCHOOL_ADMIN',
    ].includes(role ?? '');
    const canEnd = role === 'SUPER_ADMIN';
    const canEdit = role === 'SUPER_ADMIN';
    const canChangeClass =
        type === 'STUDENT' && ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN'].includes(role ?? '');
    const canTransferSchool =
        type === 'STUDENT' && ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN'].includes(role ?? '');
    const actionsDisabled =
        ending !== null ||
        changingClass !== null ||
        transferring !== null ||
        detailsMember !== null ||
        accountMember !== null;

    function open(setter: (m: SchoolMembership) => void) {
        return (membership: SchoolMembership) => {
            setSuccess('');
            setter(membership);
        };
    }

    function handleSaved(message: string) {
        setEnding(null);
        setChangingClass(null);
        setTransferring(null);
        setSuccess(message);
        retry();
    }

    if (loading) return <LoadingState label={t(`members.${kind}.loading`)} />;
    if (error) return <ErrorState message={error} onRetry={retry} />;
    if (!data) return null;

    if (data.data.length === 0) {
        return (
            <EmptyState
                icon={Users}
                title={t(`members.${kind}.emptyTitle`)}
                description={t(`members.${kind}.emptyText`)}
                action={
                    data.page > 1 ? (
                        <Button variant="outline" onClick={() => onPageChange(1)}>
                            {t('common.pagination.firstPage')}
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    const firstRow = (data.page - 1) * data.limit + 1;
    const actionProps = {
        canEdit,
        canEnd,
        canChangeClass,
        canTransferSchool,
        canManageAccounts,
        actionsDisabled,

        onEnd: open(setEnding),
        onChangeClass: open(setChangingClass),
        onTransferSchool: open(setTransferring),
        onDetails: open(setDetailsMember),
        onAccount: open(setAccountMember),
    };

    return (
        <div className="min-w-0 space-y-4">
            {success && <SuccessNotice>{success}</SuccessNotice>}

            {/* Telefon va planshet: kartalar */}
            <ul className="grid min-w-0 list-none gap-3 sm:grid-cols-2 xl:hidden">
                {data.data.map((item) => {
                    const state = membershipState(item);
                    return (
                        <li key={item.id}>
                            <Card size="sm" className="gap-4 px-4">
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="min-w-0 text-base leading-6 [overflow-wrap:anywhere]">
                                        <PersonLink item={item} />
                                    </h2>
                                    <StatusBadge tone={STATE_TONE[state]}>{t(`common.membershipStatus.${state}`)}</StatusBadge>
                                </div>
                                <DetailList>
                                    <DetailItem label={t('common.pnfl')}>
                                        <span className="tabular-nums">{item.person?.pnfl ?? t('common.notAvailable')}</span>
                                    </DetailItem>
                                    {item.schoolClass && (
                                        <DetailItem label={t('common.class')}>{item.schoolClass.name}</DetailItem>
                                    )}
                                    <DetailItem label={t('common.school')} wide>
                                        {item.school.name}
                                    </DetailItem>
                                    <DetailItem label={t('membership.start')}>{formatDate(item.startDate)}</DetailItem>
                                    <DetailItem label={t('membership.endExclusive')}>{formatDate(item.endDate)}</DetailItem>
                                </DetailList>
                                <div className="border-t pt-3">
                                    <SchoolMemberActions membership={item} layout="labels" {...actionProps} />
                                </div>

                                <Dialog
                                    open={accountMember !== null}
                                    onOpenChange={(open) => {
                                        if (!open) {
                                            setAccountMember(null);
                                        }
                                    }}
                                >
                                    <DialogContent className="sm:max-w-xl">
                                        <DialogHeader>
                                            <DialogTitle>
                                                {type === 'STUDENT'
                                                    ? 'O‘quvchi akkaunti'
                                                    : 'O‘qituvchi akkaunti'}
                                            </DialogTitle>

                                            <DialogDescription>
                                                Foydalanuvchining akkaunt holatini
                                                tekshirish yoki yangi akkaunt yaratish.
                                            </DialogDescription>
                                        </DialogHeader>

                                        {accountMember && (
                                            <MemberAccountForm
                                                key={accountMember.id}
                                                membership={accountMember}
                                                onCancel={() => {
                                                    setAccountMember(null);
                                                }}
                                                onSaved={() => {
                                                    setAccountMember(null);

                                                    setSuccess(
                                                        'Foydalanuvchi akkaunti muvaffaqiyatli yaratildi.',
                                                    );

                                                    retry();
                                                }}
                                            />
                                        )}
                                    </DialogContent>
                                </Dialog>

                            </Card>
                        </li>
                    );
                })}
            </ul>

            {/* Kompyuter: jadval */}
            <Card className="hidden py-0 xl:flex">
                <Table className="min-w-[860px]">
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 pl-5">{t('common.number')}</TableHead>
                            <TableHead>{t('common.fullName')}</TableHead>
                            <TableHead className="w-40">{t('common.pnfl')}</TableHead>
                            <TableHead>{t('common.school')}</TableHead>
                            <TableHead className="w-28">{t('membership.start')}</TableHead>
                            <TableHead className="w-32">{t('common.status')}</TableHead>
                            <TableHead className="w-44 pr-5 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.data.map((item, index) => {
                            const state = membershipState(item);
                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="pl-5 text-muted-foreground tabular-nums">{firstRow + index}</TableCell>
                                    <TableCell className="max-w-72 whitespace-normal">
                                        <PersonLink item={item} />
                                        {item.schoolClass && (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {t('common.class')}: {item.schoolClass.name}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell className="tabular-nums">{item.person?.pnfl ?? t('common.notAvailable')}</TableCell>
                                    <TableCell className="max-w-72 whitespace-normal">{item.school.name}</TableCell>
                                    <TableCell className="tabular-nums">{formatDate(item.startDate)}</TableCell>
                                    <TableCell>
                                        <StatusBadge tone={STATE_TONE[state]}>{t(`common.membershipStatus.${state}`)}</StatusBadge>
                                        {item.endDate && (
                                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                                {t('members.until', { date: formatDate(item.endDate) })}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-5">
                                        <div className="flex justify-end">
                                            <SchoolMemberActions membership={item} {...actionProps} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={onPageChange}
                total={data.total}
                pageSize={data.limit}
                shownCount={data.data.length}
                label={t(`members.${kind}.pagesLabel`)}
            />

            <Dialog open={ending !== null && canEnd} onOpenChange={(value) => !value && setEnding(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('members.end.title')}</DialogTitle>
                        <DialogDescription>{t('members.end.description')}</DialogDescription>
                    </DialogHeader>
                    {ending && (
                        <EndMembershipForm
                            key={ending.id}
                            membership={ending}
                            onCancel={() => setEnding(null)}
                            onSaved={() => handleSaved(t('members.end.success'))}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={changingClass !== null && canChangeClass} onOpenChange={(value) => !value && setChangingClass(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('members.changeClass.title')}</DialogTitle>
                        <DialogDescription>{t('members.changeClass.description')}</DialogDescription>
                    </DialogHeader>
                    {changingClass && (
                        <ChangeClassForm
                            key={changingClass.id}
                            membership={changingClass}
                            onCancel={() => setChangingClass(null)}
                            onSaved={() => handleSaved(t('members.changeClass.success'))}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={transferring !== null && canTransferSchool} onOpenChange={(value) => !value && setTransferring(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('members.transfer.title')}</DialogTitle>
                        <DialogDescription>{t('members.transfer.description')}</DialogDescription>
                    </DialogHeader>
                    {transferring && (
                        <TransferSchoolForm
                            key={transferring.id}
                            membership={transferring}
                            onCancel={() => setTransferring(null)}
                            onSaved={() => handleSaved(t('members.transfer.success'))}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={detailsMember !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailsMember(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {type === 'STUDENT'
                                ? 'O‘quvchi qo‘shimcha ma’lumotlari'
                                : 'O‘qituvchi qo‘shimcha ma’lumotlari'}
                        </DialogTitle>

                        <DialogDescription>
                            Ushbu shaxsning maktabga a’zoligiga
                            tegishli qo‘shimcha ma’lumotlarni
                            kiritish va tahrirlash.
                        </DialogDescription>
                    </DialogHeader>

                    {detailsMember && (
                        <MembershipDetailsForm
                            key={detailsMember.id}
                            membership={detailsMember}
                            onCancel={() => {
                                setDetailsMember(null);
                            }}
                            onSaved={() => {
                                setDetailsMember(null);
                                setSuccess(
                                    'Qo‘shimcha ma’lumotlar muvaffaqiyatli saqlandi.',
                                );
                                retry();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}

const ID_PATTERN = /^[1-9][0-9]*$/;
const MAX_ID = 4294967295;

function validId(value: string | null) {
    return value === null || (ID_PATTERN.test(value) && Number(value) <= MAX_ID);
}

export function SchoolMembersPage({ type }: SchoolMembersPageProps) {
    const { t } = useTranslation();
    const kind = type === 'STUDENT' ? 'students' : 'teachers';
    const [searchParams, setSearchParams] = useSearchParams();
    const { session } = useAuth();

    const [showCreate, setShowCreate] = useState(false);
    const [success, setSuccess] = useState('');
    const [refreshVersion, setRefreshVersion] = useState(0);

    const pageValue = searchParams.get('page') ?? '1';
    const schoolValue = searchParams.get('schoolId');
    const regionValue = searchParams.get('regionId');
    const districtValue = searchParams.get('districtId');
    const statusValue = searchParams.get('status') ?? '';
    const searchValue = searchParams.get('q') ?? '';
    const page = Number(pageValue);

    const canCreate = session?.profile.role === 'SUPER_ADMIN';

    const valid =
        /^\d+$/.test(pageValue) &&
        page >= 1 &&
        page <= 100000 &&
        validId(schoolValue) &&
        validId(regionValue) &&
        validId(districtValue) &&
        searchValue.length <= 100 &&
        ['', 'ACTIVE', 'ENDED', 'PLANNED'].includes(statusValue);

    const header = (
        <PageHeader
            eyebrow={t('nav.groups.education')}
            title={t(`members.${kind}.title`)}
            description={schoolValue ? t(`members.${kind}.subtitleSchool`) : t(`members.${kind}.subtitle`)}
            actions={
                canCreate ? (
                    <Button
                        type="button"
                        className="w-full sm:w-auto"
                        onClick={() => {
                            setSuccess('');
                            setShowCreate(true);
                        }}
                    >
                        <Plus aria-hidden="true" />
                        {t(`members.${kind}.add`)}
                    </Button>
                ) : undefined
            }
        />
    );

    if (!valid) {
        return (
            <div className="space-y-6">
                {header}
                <ErrorState message={t('common.invalidUrl')} />
                <Button variant="outline" onClick={() => setSearchParams({})}>
                    {t('common.resetUrl')}
                </Button>
            </div>
        );
    }

    const query = new URLSearchParams({ type, page: String(page), limit: '20' });
    if (schoolValue !== null) query.set('schoolId', String(Number(schoolValue)));
    if (regionValue) query.set('regionId', regionValue);
    if (districtValue) query.set('districtId', districtValue);
    if (searchValue.trim()) query.set('q', searchValue.trim());
    if (statusValue) query.set('status', statusValue);
    const path = `/school-memberships?${query.toString()}`;

    function changePage(nextPage: number) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(nextPage));
        setSearchParams(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            {header}

            {schoolValue && (
                <Button variant="outline" size="sm" onClick={() => setSearchParams({})}>
                    <X aria-hidden="true" />
                    {t('members.removeSchoolFilter')}
                </Button>
            )}

            {success && <SuccessNotice>{success}</SuccessNotice>}

            <SchoolMembersFilters />

            <MembersResults key={`${path}-${refreshVersion}`} path={path} type={type} onPageChange={changePage} />

            {canCreate && (
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{t(`members.${kind}.createTitle`)}</DialogTitle>
                            <DialogDescription>{t('members.create.description')}</DialogDescription>
                        </DialogHeader>
                        <CreateMemberForm
                            key={`${type}-${schoolValue ?? 'all'}`}
                            type={type}
                            {...(schoolValue !== null ? { initialSchoolId: Number(schoolValue) } : {})}
                            onCancel={() => setShowCreate(false)}
                            onSaved={() => {
                                setShowCreate(false);
                                setSuccess(t(`members.${kind}.created`));
                                const next = new URLSearchParams(searchParams);
                                next.set('page', '1');
                                setSearchParams(next);
                                setRefreshVersion((value) => value + 1);
                            }}
                        />

                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
