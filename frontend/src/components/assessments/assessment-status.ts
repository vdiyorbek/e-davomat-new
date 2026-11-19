import type { StatusTone } from '@/components/common/StatusBadge';
import type { AssessmentStatus, StudentAssessmentState } from '@/types/assessment';

export const STATUS_TONE: Record<AssessmentStatus, StatusTone> = {
    GENERATING: 'info',
    DRAFT: 'warning',
    PUBLISHED: 'success',
    CLOSED: 'neutral',
    FAILED: 'danger',
};

export const STUDENT_STATE_TONE: Record<StudentAssessmentState, StatusTone> = {
    UPCOMING: 'info',
    OPEN: 'success',
    IN_PROGRESS: 'warning',
    SUBMITTED: 'primary',
    MISSED: 'neutral',
};

export const GRADE_TONE: Record<number, StatusTone> = { 5: 'success', 4: 'primary', 3: 'warning', 2: 'danger' };

/** `datetime-local` maydoni uchun Toshkent vaqtidagi qiymat (UTC+5). */
export function toLocalInput(date: Date): string {
    return new Date(date.getTime() + 5 * 3600_000).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string {
    return new Date(`${value}:00+05:00`).toISOString();
}
