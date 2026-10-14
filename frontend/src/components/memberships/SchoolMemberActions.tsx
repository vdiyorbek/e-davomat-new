
import {
    Eye,
    Pencil,
    CalendarX2,
    ArrowRightLeft,
    GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import type { SchoolMembership } from '@/types/school-membership';

interface Props {
    membership: SchoolMembership;
    canEdit: boolean;
    canEnd: boolean;
    canChangeClass: boolean;
    canTransferSchool: boolean;
    actionsDisabled: boolean;
    onEnd: (membership: SchoolMembership) => void;
    onChangeClass: (membership: SchoolMembership) => void;
    onTransferSchool: (membership: SchoolMembership) => void;
}

export function SchoolMemberActions({
    membership,
    canEdit,
    canEnd,
    canChangeClass,
    canTransferSchool,
    actionsDisabled,
    onEnd,
    onChangeClass,
    onTransferSchool,
}: Props) {
    const personId = membership.person?.id;

    const isActiveStudent =
        membership.type === 'STUDENT' &&
        membership.endDate === null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {personId && (
                <Button asChild size="sm" variant="outline">
                    <Link to={`/persons/${personId}`}>
                        <Eye className="size-4" />
                        Ko‘rish
                    </Link>
                </Button>
            )}

            {personId && canEdit && (
                <Button asChild size="sm" variant="outline">
                    <Link to={`/persons/${personId}?edit=1`}>
                        <Pencil className="size-4" />
                        Tahrirlash
                    </Link>
                </Button>
            )}

            {isActiveStudent && canChangeClass && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionsDisabled}
                    onClick={() => onChangeClass(membership)}
                >
                    <GraduationCap className="size-4" />
                    Sinfni almashtirish
                </Button>
            )}

            {isActiveStudent && canTransferSchool && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionsDisabled}
                    onClick={() => onTransferSchool(membership)}
                >
                    <ArrowRightLeft className="size-4" />
                    Maktabga ko‘chirish
                </Button>
            )}

            {canEnd && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionsDisabled}
                    onClick={() => onEnd(membership)}
                >
                    <CalendarX2 className="size-4" />
                    {membership.endDate
                        ? 'Tugash sanasi'
                        : 'Yakunlash'}
                </Button>
            )}
        </div>
    );
}
