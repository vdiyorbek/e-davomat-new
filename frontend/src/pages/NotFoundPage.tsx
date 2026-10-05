import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ErrorCard } from '@/components/common/ErrorCard';

export function NotFoundPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
            <ErrorCard
                variant="missing"
                code="404"
                title={t('errors.404.title')}
                text={t('errors.404.text')}
                actions={
                    <>
                        <Link to="/me" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                            {t('errors.toCabinet')}
                        </Link>
                        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                            {t('common.back')}
                        </button>
                    </>
                }
            />
        </main>
    );
}
