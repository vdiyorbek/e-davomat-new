import { Link } from 'react-router';
import { BookOpen, Users } from 'lucide-react';

interface SchoolMembersLinksProps {
    schoolId: number;
    schoolName: string;
}

const linkClassName =
    'inline-flex min-h-11 items-center justify-center gap-2 ' +
    'rounded-lg border bg-background px-3 py-2 text-sm font-medium ' +
    'transition-colors hover:bg-muted ' +
    'focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring';

export function SchoolMembersLinks({
    schoolId,
    schoolName,
}: SchoolMembersLinksProps) {
    return (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
                to={`/students?schoolId=${schoolId}`}
                aria-label={`${schoolName} — o‘quvchilar`}
                className={linkClassName}
            >
                <Users aria-hidden="true" className="size-4 shrink-0" />
                O‘quvchilar
            </Link>

            <Link
                to={`/teachers?schoolId=${schoolId}`}
                aria-label={`${schoolName} — o‘qituvchilar`}
                className={linkClassName}
            >
                <BookOpen aria-hidden="true" className="size-4 shrink-0" />
                O‘qituvchilar
            </Link>
        </div>
    );
}