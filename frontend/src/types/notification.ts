export type NotificationType =
    | 'EXCUSE_SUBMITTED'
    | 'EXCUSE_APPROVED'
    | 'EXCUSE_REJECTED'
    | 'ABSENT_STREAK'
    | 'SYSTEM_ALERT'
    | 'SYSTEM_RECOVERED';

export interface AppNotification {
    id: number;
    type: NotificationType;
    payload: Record<string, string | number | boolean | null | undefined>;
    readAt: string | null;
    createdAt: string;
}

export interface NotificationsResponse {
    items: AppNotification[];
    unreadCount: number;
}
