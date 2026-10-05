import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AttendancePreview } from '@/components/auth/AttendancePreview';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Brand } from './Brand';

export function AuthLayout() {
    const { t } = useTranslation();

    return (
        <main className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[1.08fr_1fr]">
            <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex xl:p-14 2xl:p-16">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full border border-white/10"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-12 -top-12 size-72 rounded-full border border-white/10"
                />
                <Brand onDark />

                <div className="relative w-full max-w-2xl py-12">
                    <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl 2xl:text-6xl">
                        {t('auth.heroTitle')}
                    </h1>
                    <p className="mb-8 mt-5 max-w-xl text-base leading-7 text-white/70 xl:text-lg">
                        {t('auth.heroText')}
                    </p>
                    <AttendancePreview />
                </div>

                <p className="text-sm text-white/60">{t('brand.platform')}</p>
            </section>

            <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-8 xl:px-14">
                <div className="flex items-center justify-between gap-3">
                    <div className="lg:hidden">
                        <Brand compact />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center py-8">
                    <div className="w-full max-w-lg rounded-[28px] border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-9 xl:p-10">
                        <Outlet />
                    </div>
                </div>

                <p className="text-center text-xs text-muted-foreground lg:hidden">{t('brand.vendor')}</p>
            </section>
        </main>
    );
}
