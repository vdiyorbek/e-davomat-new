import { useTranslation } from 'react-i18next';
import { personFullName } from '@/lib/person';
import type { SchoolMembership } from '@/types/school-membership';

/** Dialog boshidagi qisqa ma’lumot: kim, qaysi maktab, qaysi sinf. */
export function MemberSummary({ membership }: { membership: SchoolMembership }) {
    const { t } = useTranslation();

    return (
        <div className="rounded-xl border bg-muted/40 px-4 py-3">
            <p className="font-semibold [overflow-wrap:anywhere]">
                {personFullName(membership.person, t('common.personMissing'))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {membership.school.name}
                {' · '}
                {t(`common.personType.${membership.type}`)}
                {membership.schoolClass && (
                    <>
                        {' · '}
                        {t('members.currentClass', { name: membership.schoolClass.name })}
                    </>
                )}
            </p>
        </div>
    );
}
