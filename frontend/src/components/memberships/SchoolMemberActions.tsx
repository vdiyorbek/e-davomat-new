import {
    ArrowRightLeft,
    CalendarX2,
    Eye,
    FilePenLine,
    GraduationCap,
    Pencil,
    UserRoundPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SchoolMembership } from '@/types/school-membership';
import { todayInTashkent } from '@/lib/date';
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
    /** `labels` — telefondagi kartalarda yozuvli tugmalar; `icons` — jadvalda faqat ikonka. */
    layout?: 'labels' | 'icons';
    onDetails: (membership: SchoolMembership) => void;
    canManageAccounts: boolean;
    onAccount: (membership: SchoolMembership) => void;
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
    canChangeClass,
    canTransferSchool,
    actionsDisabled,
    onEnd,
    onChangeClass,
    onTransferSchool,
    onDetails,
    layout = 'icons',
    canManageAccounts,
    onAccount,
}: Props) {
    const { t } = useTranslation();
    const personId = membership.person?.id;
    const isActiveStudent = membership.type === 'STUDENT' && membership.endDate === null;

    const actions: Action[] = [];

    const today = todayInTashkent();

    const isCurrentMembership =
        membership.startDate <= today &&
        (
            membership.endDate === null ||
            membership.endDate > today
        );

    if (
        canManageAccounts &&
        isCurrentMembership &&
        personId != null
    ) {
        actions.push({
            key: 'account',
            label: 'Akkaunt',
            icon: UserRoundPlus,
            onClick: () => onAccount(membership),
        });
    }

    actions.push({
        key: 'details',
        label: t('members.actions.details', {
            defaultValue: 'Qo‘shimcha ma’lumotlar',
        }),
        icon: FilePenLine,
        onClick: () => onDetails(membership),
    });
    if (personId) {
        actions.push({ key: 'view', label: t('members.actions.view'), icon: Eye, to: `/persons/${personId}` });
        if (canEdit) {
            actions.push({ key: 'edit', label: t('common.edit'), icon: Pencil, to: `/persons/${personId}?edit=1` });
        }
    }
    if (isActiveStudent && canChangeClass) {
        actions.push({ key: 'class', label: t('members.actions.changeClass'), icon: GraduationCap, onClick: () => onChangeClass(membership) });
    }
    if (isActiveStudent && canTransferSchool) {
        actions.push({ key: 'transfer', label: t('members.actions.transfer'), icon: ArrowRightLeft, onClick: () => onTransferSchool(membership) });
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
