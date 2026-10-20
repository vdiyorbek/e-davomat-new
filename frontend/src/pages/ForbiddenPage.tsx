import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ErrorCard } from '@/components/common/ErrorCard';
import { Button } from '@/components/ui/button';

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
                    <Button asChild size="lg">
                        <Link to="/me">{t('errors.toProfile')}</Link>
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
                        {t('common.back')}
                    </Button>
                </>
            }
        />
    );
}
