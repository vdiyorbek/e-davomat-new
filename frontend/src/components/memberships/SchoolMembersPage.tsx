import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CreateMemberForm } from './CreateMemberForm';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import type {
    SchoolMembership,
    SchoolMembershipsPage,
} from '@/types/school-membership';
import { Link, useSearchParams } from 'react-router';
import { SchoolMembersFilters } from '@/components/memberships/SchoolMembersFilters';
import { SchoolMemberActions } from './SchoolMemberActions';
import { EndMembershipForm } from './EndMembershipForm';
import { ChangeClassForm } from './ChangeClassForm';
import { TransferSchoolForm } from './TransferSchoolForm';
type MembershipType = 'STUDENT' | 'TEACHER'
interface SchoolMembersPageProps {
    type: MembershipType
}


function formatDate(value: string | null): string {
    if (!value) return 'Belgilanmagan';

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    return match
        ? `${match[3]}.${match[2]}.${match[1]}`
        : value;
}

function fullName(item: SchoolMembership): string {
    if (!item.person) return 'Shaxs ma’lumoti mavjud emas';

    return [
        item.person.lastName,
        item.person.firstName,
        item.person.middleName,
    ]
        .filter(Boolean)
        .join(' ');
}

interface MembersResultsProps {
    path: string;
    type: MembershipType;
    onPageChange: (page: number) => void;
}

function MembersResults({
    path,
    type,
    onPageChange,
}: MembersResultsProps) {
    const peopleLabel = type === "STUDENT" ? "O'quvchilar" : "O'qituvchilar"
    const { data, loading, error, retry } =
        useApiQuery<SchoolMembershipsPage>(path);
    const { session } = useAuth();

    const [endingMembership, setEndingMembership] =
        useState<SchoolMembership | null>(null);

    const [endSuccess, setEndSuccess] = useState('');

    const role = session?.profile.role;

    const canEnd = role === 'SUPER_ADMIN';
    const canEdit = role === 'SUPER_ADMIN';

    const canChangeClass =
        type === 'STUDENT' &&
        ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN', 'SCHOOL_ADMIN']
            .includes(role ?? '');

    const canTransferSchool =
        type === 'STUDENT' &&
        ['SUPER_ADMIN', 'REGION_ADMIN', 'DISTRICT_ADMIN']
            .includes(role ?? '');
    const [changingClass, setChangingClass] =
        useState<SchoolMembership | null>(null);

    const [transferringSchool, setTransferringSchool] =
        useState<SchoolMembership | null>(null);

    const actionsDisabled =
        endingMembership !== null ||
        changingClass !== null ||
        transferringSchool !== null;

    function openEnd(membership: SchoolMembership) {
        setEndSuccess('');
        setChangingClass(null);
        setTransferringSchool(null);
        setEndingMembership(membership);
    }

    function openChangeClass(membership: SchoolMembership) {
        setEndSuccess('');
        setEndingMembership(null);
        setTransferringSchool(null);
        setChangingClass(membership);
    }

    function openTransferSchool(membership: SchoolMembership) {
        setEndSuccess('');
        setEndingMembership(null);
        setChangingClass(null);
        setTransferringSchool(membership);
    }

    function handleActionSaved(message: string) {
        setEndingMembership(null);
        setChangingClass(null);
        setTransferringSchool(null);
        setEndSuccess(message);
        retry();
    }
    if (loading) {
        return (
            <p
                role="status"
                className="rounded-xl border bg-background p-6 text-sm text-muted-foreground"
            >
                {peopleLabel} yuklanmoqda…
            </p>
        );
    }

    if (error) {
        return (
            <div
                role="alert"
                className="space-y-4 rounded-xl border bg-background p-5"
            >
                <p className="text-sm text-destructive">{error}</p>

                <Button variant="outline" onClick={retry}>
                    Qayta urinish
                </Button>
            </div>
        );
    }

    if (!data) return null;

    if (data.data.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
                <h2 className="font-semibold">
                    {peopleLabel} topilmadi
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Tanlangan doirada o‘quvchi biriktirishlari mavjud emas
                    yoki sahifa raqami ro‘yxat chegarasidan tashqarida.
                </p>

                {data.page > 1 && (
                    <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => onPageChange(1)}
                    >
                        Birinchi sahifaga qaytish
                    </Button>
                )}
            </div>
        );
    }

    const firstRow = (data.page - 1) * data.limit + 1;
    const lastRow = firstRow + data.data.length - 1;

    return (
        <div className="min-w-0 space-y-4">
            <p className="text-sm tabular-nums text-muted-foreground">
                Jami {data.total} ta biriktirish.
                {' '}{firstRow}–{lastRow} ko‘rsatilmoqda.
            </p>
            {endSuccess && (
                <p
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
                >
                    {endSuccess}
                </p>
            )}

            {endingMembership && canEnd && (
                <EndMembershipForm
                    key={endingMembership.id}
                    membership={endingMembership}
                    onCancel={() => setEndingMembership(null)}
                    onSaved={() =>
                        handleActionSaved(
                            'Maktabga biriktirish muvaffaqiyatli yakunlandi.'
                        )
                    }
                />
            )}
            {changingClass && canChangeClass && (
                <section className="rounded-2xl border bg-card p-5">
                    <h2 className="mb-4 text-lg font-semibold">
                        O‘quvchini boshqa sinfga o‘tkazish
                    </h2>

                    <ChangeClassForm
                        key={changingClass.id}
                        membership={changingClass}
                        onCancel={() => setChangingClass(null)}
                        onSaved={() =>
                            handleActionSaved('O‘quvchining sinfi almashtirildi.')
                        }
                    />
                </section>
            )}

            {transferringSchool && canTransferSchool && (
                <section className="rounded-2xl border bg-card p-5">
                    <h2 className="mb-4 text-lg font-semibold">
                        O‘quvchini boshqa maktabga ko‘chirish
                    </h2>

                    <TransferSchoolForm
                        key={transferringSchool.id}
                        membership={transferringSchool}
                        onCancel={() => setTransferringSchool(null)}
                        onSaved={() =>
                            handleActionSaved('O‘quvchi boshqa maktabga ko‘chirildi.')
                        }
                    />
                </section>
            )}

            {/* Mobil ko‘rinish */}
            <ul className="grid min-w-0 list-none gap-4 md:hidden">
                {data.data.map((item) => (
                    <li
                        key={item.id}
                        className="min-w-0 rounded-2xl border bg-background p-5"
                    >
                        <h2 className="font-semibold leading-6 [overflow-wrap:anywhere]">
                            {item.person ? (
                                <Link
                                    to={`/persons/${item.person.id}`}
                                    className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
                                >
                                    {fullName(item)}
                                </Link>
                            ) : (
                                <span>Shaxs ma’lumotlari mavjud emas</span>
                            )}
                        </h2>

                        <dl className="mt-4 space-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground">
                                    PNFL
                                </dt>
                                <dd className="mt-1 break-all">
                                    {item.person?.pnfl ?? 'Mavjud emas'}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Maktab
                                </dt>
                                <dd className="mt-1 [overflow-wrap:anywhere]">
                                    {item.school.name}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Boshlanish sanasi
                                </dt>
                                <dd className="mt-1">
                                    {formatDate(item.startDate)}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-muted-foreground">
                                    Faol bo‘lmaydigan birinchi kun
                                </dt>
                                <dd className="mt-1">
                                    {formatDate(item.endDate)}
                                </dd>
                            </div>
                        </dl>
                        <div className="mt-4 border-t pt-4">
                            <p className="mb-3 text-xs font-medium text-muted-foreground">
                                Amallar
                            </p>

                            <SchoolMemberActions
                                membership={item}
                                canEdit={canEdit}
                                canEnd={canEnd}
                                canChangeClass={canChangeClass}
                                canTransferSchool={canTransferSchool}
                                actionsDisabled={actionsDisabled}
                                onEnd={openEnd}
                                onChangeClass={openChangeClass}
                                onTransferSchool={openTransferSchool}
                            />
                        </div>
                    </li>

                ))}
            </ul>

            {/* Planshet va kompyuter ko‘rinishi */}
            <div className="hidden min-w-0 overflow-hidden rounded-2xl border bg-background md:block">
                <div
                    role="region"
                    aria-label={`${peopleLabel} jadvali`}
                    tabIndex={0}
                    className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    <table
                        className={
                            type === 'STUDENT'
                                ? 'w-full min-w-[1700px] table-auto text-left text-sm'
                                : 'w-full min-w-[1100px] table-auto text-left text-sm'
                        }
                    >
                        <caption className="sr-only">
                            {peopleLabel} maktablarga biriktirishlar
                        </caption>

                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th scope="col" className="w-16 p-4">№</th>
                                <th scope="col" className="w-1/4 p-4">F.I.Sh.</th>
                                <th scope="col" className="w-40 p-4">PNFL</th>
                                <th scope="col" className="p-4">Maktab</th>
                                <th scope="col" className="w-32 p-4">
                                    Boshlanish
                                </th>
                                <th scope="col" className="w-40 p-4">
                                    Faol bo‘lmaydigan birinchi kun
                                </th>
                                <th
                                    scope="col"
                                    className={
                                        type === 'STUDENT'
                                            ? 'min-w-[720px] whitespace-nowrap px-4 py-3 text-left'
                                            : 'min-w-[350px] whitespace-nowrap px-4 py-3 text-left'
                                    }
                                >
                                    Amallar
                                </th>
                            </tr>

                        </thead>

                        <tbody>
                            {data.data.map((item, index) => (
                                <tr
                                    key={item.id}
                                    className="border-b align-top last:border-0 hover:bg-muted/30"
                                >
                                    <td className="p-4 text-muted-foreground">
                                        {firstRow + index}
                                    </td>

                                    <th
                                        scope="row"
                                        className="p-4 font-medium leading-6 [overflow-wrap:anywhere]"
                                    >
                                        {item.person ? (
                                            <Link
                                                to={`/persons/${item.person.id}`}
                                                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
                                            >
                                                {fullName(item)}
                                            </Link>
                                        ) : (
                                            <span>Shaxs ma’lumotlari mavjud emas</span>
                                        )}
                                    </th>

                                    <td className="p-4 tabular-nums">
                                        {item.person?.pnfl ?? 'Mavjud emas'}
                                    </td>

                                    <td className="p-4 leading-6 [overflow-wrap:anywhere]">
                                        {item.school.name}
                                    </td>

                                    <td className="p-4">
                                        {formatDate(item.startDate)}
                                    </td>

                                    <td className="p-4">
                                        {formatDate(item.endDate)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <SchoolMemberActions
                                            membership={item}
                                            canEdit={canEdit}
                                            canEnd={canEnd}
                                            canChangeClass={canChangeClass}
                                            canTransferSchool={canTransferSchool}
                                            actionsDisabled={actionsDisabled}
                                            onEnd={openEnd}
                                            onChangeClass={openChangeClass}
                                            onTransferSchool={openTransferSchool}
                                        />
                                    </td>
                                </tr>

                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <nav
                aria-label={`${peopleLabel} ro‘yxati sahifalari`}
                className="flex flex-wrap items-center justify-between gap-3"
            >
                <Button
                    variant="outline"
                    disabled={data.page <= 1}
                    onClick={() => onPageChange(data.page - 1)}
                    className="min-h-11"
                >
                    Oldingi
                </Button>

                <span className="text-sm tabular-nums text-muted-foreground">
                    {data.page} / {data.totalPages}
                </span>

                <Button
                    variant="outline"
                    disabled={
                        data.page >= data.totalPages ||
                        data.page >= 100000
                    }
                    onClick={() => onPageChange(data.page + 1)}
                    className="min-h-11"
                >
                    Keyingi
                </Button>
            </nav>
        </div>
    );
}

export function SchoolMembersPage({ type, }: SchoolMembersPageProps) {
    const peopleLabel = type === "STUDENT" ? "O'quvchilar" : "O'qituvchilar";
    const membershipLabel = type === "STUDENT" ? "o'quvchi" : "o'qituvchi";
    const [searchParams, setSearchParams] = useSearchParams();

    const pageValue = searchParams.get('page') ?? '1';
    const schoolValue = searchParams.get('schoolId');
    const regionValue = searchParams.get('regionId');
    const districtValue = searchParams.get('districtId');
    const statusValue = searchParams.get('status') ?? '';

    const validStatus = [
        '',
        'ACTIVE',
        'ENDED',
        'PLANNED',
    ].includes(statusValue);
    const searchValue = searchParams.get('q') ?? '';
    const validAreaFilters = [regionValue, districtValue].every(
        (value) =>
            value === null ||
            (
                /^[1-9][0-9]*$/.test(value) &&
                Number.isSafeInteger(Number(value)) &&
                Number(value) <= 4294967295
            ),
    );

    const validSearch = searchValue.length <= 100;
    const page = Number(pageValue);
    const { session } = useAuth()

    const [showCreateForm, setShowCreateForm] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [refreshVersion, setRefreshVersion] = useState(0)

    const canCreate = session?.profile.role === 'SUPER_ADMIN'
    const pageValid =
        /^\d+$/.test(pageValue) &&
        Number.isInteger(page) &&
        page >= 1 &&
        page <= 100000;

    const schoolValid =
        schoolValue === null ||
        (
            /^\d+$/.test(schoolValue) &&
            Number.isInteger(Number(schoolValue)) &&
            Number(schoolValue) >= 1 &&
            Number(schoolValue) <= 4294967295
        );

    if (!pageValid || !schoolValid || !validAreaFilters || !validSearch || !validStatus) {
        return (
            <div role="alert" className="space-y-4">
                <p>Sahifa raqami yoki maktab identifikatori noto‘g‘ri.</p>

                <Button
                    variant="outline"
                    onClick={() => setSearchParams({})}
                >
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                            {peopleLabel}
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {schoolValue
                                ? `Tanlangan maktabdagi ${membershipLabel} biriktirishlari.`
                                : `Boshqaruv doirangizdagi ${membershipLabel} biriktirishlari.`}
                            {' '}Barcha davrlar ko‘rsatiladi.
                        </p>
                    </div>
                </Button>
            </div>
        );
    }

    const query = new URLSearchParams({
        type,
        page: String(page),
        limit: '20',
    });

    if (schoolValue !== null) {
        query.set('schoolId', String(Number(schoolValue)));
    }
    if (regionValue) {
        query.set('regionId', regionValue);
    }

    if (districtValue) {
        query.set('districtId', districtValue);
    }

    if (searchValue.trim()) {
        query.set('q', searchValue.trim());
    }
    if (statusValue) {
        query.set('status', statusValue);
    }
    const path = `/school-memberships?${query.toString()}`;

    function changePage(nextPage: number) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(nextPage));
        setSearchParams(next);
    }

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {peopleLabel}
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {schoolValue
                        ? 'Tanlangan maktabdagi o‘quvchi biriktirishlari.'
                        : 'Boshqaruv doirangizdagi o‘quvchi biriktirishlari.'}
                    {' '}Barcha davrlar ko‘rsatiladi.
                </p>
            </div>

            {schoolValue && (
                <Button
                    variant="outline"
                    onClick={() => setSearchParams({})}
                    className="min-h-11"
                >
                    Maktab filtrini olib tashlash
                </Button>
            )}
            {successMessage && (
                <p
                    role="status"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300"
                >
                    {successMessage}
                </p>
            )}

            {canCreate && !showCreateForm && (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => {
                            setSuccessMessage('');
                            setShowCreateForm(true);
                        }}
                    >
                        {type === 'STUDENT'
                            ? 'O‘quvchi qo‘shish'
                            : 'O‘qituvchi qo‘shish'}
                    </Button>
                </div>
            )}

            {canCreate && showCreateForm && (
                <section
                    aria-labelledby="create-member-title"
                    className="min-w-0 rounded-2xl border bg-background p-5 sm:p-6"
                >
                    <h2
                        id="create-member-title"
                        className="mb-5 text-lg font-semibold"
                    >
                        {type === 'STUDENT'
                            ? 'O‘quvchini maktabga biriktirish'
                            : 'O‘qituvchini maktabga biriktirish'}
                    </h2>

                    <CreateMemberForm
                        key={`${type}-${schoolValue ?? 'all'}`}
                        type={type}
                        {...(
                            schoolValue !== null
                                ? { initialSchoolId: Number(schoolValue) }
                                : {}
                        )}
                        onCancel={() => setShowCreateForm(false)}
                        onSaved={() => {
                            setShowCreateForm(false);

                            setSuccessMessage(
                                type === 'STUDENT'
                                    ? 'O‘quvchi maktabga muvaffaqiyatli biriktirildi.'
                                    : 'O‘qituvchi maktabga muvaffaqiyatli biriktirildi.',
                            );

                            const next = new URLSearchParams(searchParams);
                            next.set('page', '1');
                            setSearchParams(next);

                            setRefreshVersion((value) => value + 1);
                        }}
                    />
                </section>
            )}
            <SchoolMembersFilters />
            <MembersResults
                key={`${path}-${refreshVersion}`}
                path={path}
                type={type}
                onPageChange={changePage}
            />
        </div>
    );
}