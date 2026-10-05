import { Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const { t } = useTranslation();
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/me" replace />;
  }

  return (
    <>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('auth.title')}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{t('auth.subtitle')}</p>

      <LoginForm />

      <p className="mt-7 text-sm leading-6 text-muted-foreground">
        {t('auth.help')}{' '}
        <span className="font-medium text-primary">{t('auth.helpAdmin')}</span>
      </p>
    </>
  );
}
