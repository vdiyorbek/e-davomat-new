
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { UserPhotoEditor } from '@/components/users/UserPhotoEditor';
import { reloadCurrentProfile } from '@/lib/auth-session';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export function ProfilePage() {
    const { session } = useAuth();
    const { t } = useTranslation();

    if (!session) return null;

    const user = session.profile;

    const fullName = [
        user.lastName,
        user.firstName,
        user.middleName,
    ].filter(Boolean).join(' ') || user.login;

    const roleName = t(`roles.${user.role}`);

    const fields = [
        ['Familiyasi', user.lastName],
        ['Ismi', user.firstName],
        ['Otasining ismi', user.middleName],
        ['Login', user.login],
        ['Tizimdagi roli', roleName],
    ];

    return (
        <div className="w-full min-w-0 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">
                    Shaxsiy ma’lumotlar
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Tizim foydalanuvchisi profili
                </p>
            </div>

            <Card className="rounded-2xl">

                <CardHeader>
                    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                        <UserPhotoEditor
                            userId={user.id}
                            photoUrl={user.photoUrl}
                            onUploaded={async () => {
                                await reloadCurrentProfile();
                            }}
                        />

                        <div className="space-y-1">
                            <CardTitle>{fullName}</CardTitle>

                            <p className="text-sm text-muted-foreground">
                                @{user.login}
                            </p>
                        </div>
                    </div>
                </CardHeader>


                <CardContent className="space-y-5">
                    <div className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="size-4" />
                        <span>{roleName}</span>
                    </div>

                    <dl className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                        {fields.map(([label, value]) => (
                            <div key={label ?? ''}>
                                <dt className="text-xs text-muted-foreground">
                                    {label}
                                </dt>
                                <dd className="mt-1 text-sm font-medium">
                                    {value || 'Kiritilmagan'}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}
