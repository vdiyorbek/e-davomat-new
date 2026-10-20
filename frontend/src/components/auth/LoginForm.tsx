import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export function LoginForm() {
  const { t } = useTranslation();
  const { signIn, notice } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await signIn(username, password);
      setPassword('');
    } catch (error: unknown) {
      setError(
        error instanceof ApiError
          ? error.message
          : t('common.unexpected'),
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'h-13 rounded-2xl border-input bg-background px-4 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25 disabled:opacity-60';

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-6"
      aria-busy={busy}
    >
      {notice && !error && (
        <Alert>
          <AlertDescription className="text-foreground">{notice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" id="login-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2.5">
        <Label htmlFor="login" className="text-sm font-semibold">
          {t('auth.login')}
        </Label>

        <Input
          id="login"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.loginPlaceholder')}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={3}
          maxLength={50}
          required
          disabled={busy}
          aria-describedby={error ? 'login-error' : undefined}
          className={inputClass}
        />
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="password" className="text-sm font-semibold">
          {t('auth.password')}
        </Label>

        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
            disabled={busy}
            aria-describedby={error ? 'login-error' : undefined}
            className={`${inputClass} pr-16 sm:pr-32`}
          />

          <Button
            type="button"
            variant="ghost"
            aria-controls="password"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={showPassword}
            disabled={busy}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-2 right-2 h-auto gap-1.5 px-3 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            <span className="max-sm:sr-only">{showPassword ? t('auth.hide') : t('auth.show')}</span>
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={busy}
        className="h-13 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-none hover:bg-primary/90"
      >
        {busy ? (
          <span role="status" className="flex items-center gap-2">
            <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
            {t('auth.checking')}
          </span>
        ) : (
          <>
            <LogIn aria-hidden="true" className="size-5" />
            {t('auth.submit')}
          </>
        )}
      </Button>
    </form>
  );
}