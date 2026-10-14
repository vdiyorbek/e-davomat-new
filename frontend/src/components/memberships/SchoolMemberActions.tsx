
import { Eye, Pencil, CalendarX2 } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import type { SchoolMembership } from '@/types/school-membership';

interface Props {
    membership: SchoolMembership;
    canEdit: boolean;
    canEnd: boolean;
    endDisabled: boolean;
    onEnd: (membership: SchoolMembership) => void;
}

export function SchoolMemberActions({
    membership,
    canEdit,
    canEnd,
    endDisabled,
    onEnd,
}: Props) {
    const personId = membership.person?.id;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {personId && (
                <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/persons/${personId}`}>
                        <Eye className="size-4" />
                        Ko‘rish
                    </Link>
                </Button>
            )}

            {personId && canEdit && (
                <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/persons/${personId}?edit=1`}>
                        <Pencil className="size-4" />
                        Tahrirlash
                    </Link>
                </Button>
            )}

            {canEnd && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={endDisabled}
                    onClick={() => onEnd(membership)}
                >
                    <CalendarX2 className="size-4" />
                    {membership.endDate ? 'Tugash sanasi' : 'Yakunlash'}
                </Button>
            )}
        </div>
    );
}
