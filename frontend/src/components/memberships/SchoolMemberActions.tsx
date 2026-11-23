import {
    ArrowRightLeft,
    CalendarX2,
    Eye,
    Pencil,
    } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SchoolMembership } from '@/types/school-membership';
interface Props {
    membership: SchoolMembership;
    canEdit: boolean;
    canEnd: boolean;
    canMove: boolean;
    actionsDisabled: boolean;
    onEnd: (membership: SchoolMembership) => void;
    onMove: (membership: SchoolMembership) => void;
    /** `labels` — telefondagi kartalarda yozuvli tugmalar; `icons` — jadvalda faqat ikonka. */
    layout?: 'labels' | 'icons';
}

interface Action {
    key: string;
    label: string;
    icon: LucideIcon;
    to?: string;
    onClick?: () => void;
}

export function SchoolMemberActions({
    membership,
    canEdit,
    canEnd,
    canMove,
    actionsDisabled,
    onEnd,
    onMove,
    layout = 'icons',
}: Props) {
    const { t } = useTranslation();
    const personId = membership.person?.id;
    const isActiveStudent = membership.type === 'STUDENT' && membership.endDate === null;

    const actions: Action[] = [];

    if (personId) {
        actions.push({ key: 'view', label: t('members.actions.view'), icon: Eye, to: `/persons/${personId}` });
        if (canEdit) {
            actions.push({ key: 'edit', label: t('common.edit'), icon: Pencil, to: `/persons/${personId}?edit=1` });
        }
    }
    if (isActiveStudent && canMove) {
        actions.push({ key: 'move', label: t('members.actions.move'), icon: ArrowRightLeft, onClick: () => onMove(membership) });
    }
    if (canEnd) {
        actions.push({
            key: 'end',
            label: membership.endDate ? t('members.actions.endDate') : t('members.actions.end'),
            icon: CalendarX2,
            onClick: () => onEnd(membership),
        });
    }

    if (layout === 'labels') {
        return (
            <div className="flex flex-wrap gap-2">
                {actions.map(({ key, label, icon: Icon, to, onClick }) =>
                    to ? (
                        <Button key={key} asChild size="sm" variant="outline">
                            <Link to={to}>
                                <Icon aria-hidden="true" />
                                {label}
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={actionsDisabled}
                            onClick={onClick}
                        >
                            <Icon aria-hidden="true" />
                            {label}
                        </Button>
                    ),
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            {actions.map(({ key, label, icon: Icon, to, onClick }) => (
                <Tooltip key={key}>
                    <TooltipTrigger asChild>
                        {to ? (
                            <Button asChild size="icon-sm" variant="outline" className="size-8">
                                <Link to={to} aria-label={label}>
                                    <Icon aria-hidden="true" />
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                className="size-8"
                                aria-label={label}
                                disabled={actionsDisabled}
                                onClick={onClick}
                            >
                                <Icon aria-hidden="true" />
                            </Button>
                        )}
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
