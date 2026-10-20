import { GraduationCap, Presentation } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SchoolMembersLinksProps {
    schoolId: number;
    schoolName: string;
    className?: string;
}

export function SchoolMembersLinks({ schoolId, schoolName, className }: SchoolMembersLinksProps) {
    const { t } = useTranslation();

    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            <Button asChild variant="outline" size="sm">
                <Link to={`/students?schoolId=${schoolId}`} aria-label={`${schoolName} — ${t('nav.items.students')}`}>
                    <GraduationCap aria-hidden="true" />
                    {t('nav.items.students')}
                </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link to={`/teachers?schoolId=${schoolId}`} aria-label={`${schoolName} — ${t('nav.items.teachers')}`}>
                    <Presentation aria-hidden="true" />
                    {t('nav.items.teachers')}
                </Link>
            </Button>
        </div>
    );
}
