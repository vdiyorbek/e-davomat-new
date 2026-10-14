
import type { ReactElement } from 'react';
import { Tooltip } from 'radix-ui';
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

function ActionTooltip({
    label,
    children,
}: {
    label: string;
    children: ReactElement;
}) {
    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                {children}
            </Tooltip.Trigger>

            <Tooltip.Portal>
                <Tooltip.Content
                    side="top"
                    sideOffset={8}
                    collisionPadding={8}
                    className="z-50 rounded-lg border border-border
            bg-popover px-3 py-2 text-xs font-medium
            text-popover-foreground shadow-lg"
                >
                    {label}
                    <Tooltip.Arrow className="fill-popover" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

// Telefonda yozuvli, planshet va kompyuterda
// faqat ikonka ko‘rinadi.
const actionStyle =
    'h-9 w-auto gap-2 px-3 md:h-8 md:w-8 md:px-0';

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

    const endLabel = membership.endDate
        ? 'Tugash sanasi'
        : 'Yakunlash';

    return (
        <Tooltip.Provider delayDuration={250}>
            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
                {personId && (
                    <ActionTooltip label="Ko‘rish">
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className={actionStyle}
                        >
                            <Link
                                to={`/persons/${personId}`}
                                aria-label="Ko‘rish"
                            >
                                <Eye className="size-4" aria-hidden="true" />
                                <span className="md:sr-only">Ko‘rish</span>
                            </Link>
                        </Button>
                    </ActionTooltip>
                )}

                {personId && canEdit && (
                    <ActionTooltip label="Tahrirlash">
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className={actionStyle}
                        >
                            <Link
                                to={`/persons/${personId}?edit=1`}
                                aria-label="Tahrirlash"
                            >
                                <Pencil className="size-4" aria-hidden="true" />
                                <span className="md:sr-only">Tahrirlash</span>
                            </Link>
                        </Button>
                    </ActionTooltip>
                )}

                {isActiveStudent && canChangeClass && (
                    <ActionTooltip label="Sinfni almashtirish">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={actionStyle}
                            aria-label="Sinfni almashtirish"
                            disabled={actionsDisabled}
                            onClick={() => onChangeClass(membership)}
                        >
                            <GraduationCap className="size-4" aria-hidden="true" />
                            <span className="md:sr-only">
                                Sinfni almashtirish
                            </span>
                        </Button>
                    </ActionTooltip>
                )}

                {isActiveStudent && canTransferSchool && (
                    <ActionTooltip label="Maktabga ko‘chirish">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={actionStyle}
                            aria-label="Maktabga ko‘chirish"
                            disabled={actionsDisabled}
                            onClick={() => onTransferSchool(membership)}
                        >
                            <ArrowRightLeft className="size-4" aria-hidden="true" />
                            <span className="md:sr-only">
                                Maktabga ko‘chirish
                            </span>
                        </Button>
                    </ActionTooltip>
                )}

                {canEnd && (
                    <ActionTooltip label={endLabel}>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={actionStyle}
                            aria-label={endLabel}
                            disabled={actionsDisabled}
                            onClick={() => onEnd(membership)}
                        >
                            <CalendarX2 className="size-4" aria-hidden="true" />
                            <span className="md:sr-only">{endLabel}</span>
                        </Button>
                    </ActionTooltip>
                )}
            </div>
        </Tooltip.Provider>
    );
}
