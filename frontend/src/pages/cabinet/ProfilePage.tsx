import { AtSign, IdCard, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { UserPhotoEditor } from '@/components/users/UserPhotoEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { reloadCurrentProfile } from '@/lib/auth-session';
import { personFullName } from '@/lib/person';

export function ProfilePage() {
    const { session } = useAuth();
    const { t } = useTranslation();

    if (!session) return null;

    const user = session.profile;
    const fullName = personFullName(user, user.login);
    const roleName = t(`roles.${user.role}`);

    const fields = [
        { label: t('common.lastName'), value: user.lastName },
        { label: t('common.firstName'), value: user.firstName },
        { label: t('common.middleName'), value: user.middleName },
        { label: t('profile.login'), value: user.login },
        { label: t('profile.role'), value: roleName },
    ];

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow={t('nav.groups.personal')}
                title={t('profile.title')}
                description={t('profile.subtitle')}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <Card className="items-center p-6 text-center">
                    <UserPhotoEditor
                        userId={user.id}
                        photoUrl={user.photoUrl}
                        onUploaded={async () => {
                            await reloadCurrentProfile();
                        }}
                    />
                    <div className="min-w-0 space-y-1">
                        <p className="font-heading text-xl font-bold [overflow-wrap:anywhere]">{fullName}</p>
                        <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                            <AtSign aria-hidden="true" className="size-3.5" />
                            {user.login}
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary dark:text-foreground">
                        <ShieldCheck aria-hidden="true" className="size-4" />
                        {roleName}
                    </span>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <IdCard aria-hidden="true" className="size-5 text-primary" />
                            {t('profile.details')}
                        </CardTitle>
                        <CardDescription>{t('profile.detailsHint')}</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                            {fields.map(({ label, value }) => (
                                <div key={label} className="min-w-0 rounded-xl bg-muted/40 px-4 py-3">
                                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <UserRound aria-hidden="true" className="size-3.5" />
                                        {label}
                                    </dt>
                                    <dd className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]">
                                        {value || (
                                            <span className="font-normal text-muted-foreground">
                                                {t('profile.notEntered')}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
