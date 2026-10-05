import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
    'h-14 rounded-2xl border-input bg-background px-4 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25 disabled:opacity-60';

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-6"
      aria-busy={busy}
    >
      {notice && !error && (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          id="login-error"
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
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
            className={`${inputClass} pr-24`}
          />

          <button
            type="button"
            aria-controls="password"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={showPassword}
            disabled={busy}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-1 right-2 rounded-lg px-3 text-sm font-semibold text-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {showPassword ? t('auth.hide') : t('auth.show')}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={busy}
        className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-none hover:bg-primary/90"
      >
        {busy ? (
          <span role="status" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
            />
            {t('auth.checking')}
          </span>
        ) : (
          t('auth.submit')
        )}
      </Button>
    </form>
  );
}