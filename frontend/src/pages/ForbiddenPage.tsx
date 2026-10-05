import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ErrorCard } from '@/components/common/ErrorCard';

export function ForbiddenPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <ErrorCard
            variant="forbidden"
            code="403"
            title={t('errors.403.title')}
            text={t('errors.403.text')}
            actions={
                <>
                    <Link to="/me" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        {t('errors.toProfile')}
                    </Link>
                    <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        {t('common.back')}
                    </button>
                </>
            }
        />
    );
}
