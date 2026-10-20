import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ErrorCard } from '@/components/common/ErrorCard';
import { Button } from '@/components/ui/button';

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
                        <Button asChild size="lg">
                        <Link to="/me">{t('errors.toCabinet')}</Link>
                    </Button>
                        <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
                            {t('common.back')}
                        </Button>
                    </>
                }
            />
        </main>
    );
}
