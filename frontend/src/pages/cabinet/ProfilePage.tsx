import { Building2, ContactRound, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

import { PersonPhoto } from '@/components/persons/PersonPhoto';

interface DetailField {
    label: string;
    value: string | null | undefined;
    fullWidth?: boolean;
}

function DetailList({ fields }: { fields: DetailField[] }) {
    return (
        <dl className="grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2">
            {fields.map(({ label, value, fullWidth }) => (
                <div key={label} className={fullWidth ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
                    <dt className="text-xs font-medium text-muted-foreground sm:text-sm">
                        {label}
                    </dt>
                    <dd className="mt-1.5 whitespace-pre-line text-sm font-medium leading-6 [overflow-wrap:anywhere]">
                        {value?.trim() || (
                            <span className="font-normal text-muted-foreground">Kiritilmagan</span>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function formatBirthDate(value: string | null | undefined): string | null {
    if (!value) return null;
    // DATE qiymatini vaqt zonasiga aylantirmasdan ko‘rsatamiz.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value;
    return `${match[3]}.${match[2]}.${match[1]}`;
}



export function ProfilePage() {
    const { t } = useTranslation();
    const { session } = useAuth();
    if (!session) return null;

    const { profile } = session;
    const { person } = profile;
    const fullName = [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' ');

    const roleName = t(`roles.${profile.role}`);
    const gender = person.gender === 'MALE'
        ? 'Erkak'
        : person.gender === 'FEMALE' ? 'Ayol' : null;

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Shaxsiy ma’lumotlar</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Profilingiz va hisobingizga tegishli ma’lumotlar.
                </p>
            </div>

            <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-6">
                <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl py-0">
                    <div aria-hidden="true" className="h-20 bg-[#16223c] sm:h-24" />
                    <CardContent className="min-w-0 px-5 pb-6 sm:px-6">
                        <div className="relative -mt-12 mb-4 w-fit">
                            <PersonPhoto
                                personId={person.id}
                                photoUrl={person.photoUrl}
                                name={fullName}
                            />
                        </div>
                        <h2 className="text-lg font-semibold leading-7 [overflow-wrap:anywhere]">{fullName}</h2>
                        <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">@{profile.login}</p>
                        <span className="mt-4 inline-flex max-w-full items-start gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium leading-5 text-blue-700 dark:text-blue-300">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span className="min-w-0 break-words">{roleName}</span>
                        </span>
                        <div className="mt-6 border-t pt-5">
                            <Link to="/me/schools" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <Building2 aria-hidden="true" className="size-4 shrink-0" />
                                Mening maktablarim
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <div className="min-w-0 space-y-5 sm:space-y-6">
                    <Card className="min-w-0 rounded-2xl">
                        <CardHeader className="px-5 sm:px-6">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <UserRound aria-hidden="true" className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                Shaxsiy ma’lumotlar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 sm:px-6">
                            <DetailList fields={[
                                { label: 'Familiyasi', value: person.lastName },
                                { label: 'Ismi', value: person.firstName },
                                { label: 'Otasining ismi', value: person.middleName, fullWidth: true },
                                { label: 'PNFL (JShShIR)', value: person.pnfl },
                                { label: 'Tug‘ilgan sana', value: formatBirthDate(person.birthDate) },
                                { label: 'Jinsi', value: gender },
                                { label: 'Millati', value: person.nationality },
                            ]} />
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 rounded-2xl">
                        <CardHeader className="px-5 sm:px-6">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ContactRound aria-hidden="true" className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                Aloqa ma’lumotlari
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 sm:px-6">
                            <DetailList fields={[
                                { label: 'Telefon raqami', value: person.phoneNumber, fullWidth: true },
                                { label: 'Yashash manzili', value: person.address, fullWidth: true },
                            ]} />
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 rounded-2xl">
                        <CardHeader className="px-5 sm:px-6">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                Hisob ma’lumotlari
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 sm:px-6">
                            <DetailList fields={[
                                { label: 'Login', value: profile.login },
                                { label: 'Hisob roli', value: roleName },
                            ]} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}