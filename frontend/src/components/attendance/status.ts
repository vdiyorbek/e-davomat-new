import type { StatusTone } from '@/components/common/StatusBadge';
import type { AttendanceStatus } from '@/types/daily-attendance';

export const ATTENDANCE_TONE: Record<AttendanceStatus, StatusTone> = {
    inside: 'success',
    left: 'warning',
    excused: 'primary',
    absent: 'danger',
    anomaly: 'neutral',
    day_off: 'neutral',
    unconfigured: 'warning',
    conflict: 'danger',
};

export const ATTENDANCE_STRIPE: Record<AttendanceStatus, string> = {
    inside: 'bg-success',
    left: 'bg-warning',
    excused: 'bg-primary',
    absent: 'bg-destructive',
    anomaly: 'bg-border',
    day_off: 'bg-muted-foreground',
    unconfigured: 'bg-warning',
    conflict: 'bg-destructive',
};
