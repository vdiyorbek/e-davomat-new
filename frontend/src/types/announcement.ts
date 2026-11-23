export type AnnouncementKind = 'INFO' | 'TASK' | 'URGENT';
export type AnnouncementScope = 'ALL' | 'REGION' | 'DISTRICT' | 'SCHOOLS';
export type RecipientRole = 'REGION_ADMIN' | 'DISTRICT_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'MAHALLA_INSPECTOR';

export interface AnnouncementListItem {
    id: number;
    kind: AnnouncementKind;
    title: string;
    dueDate: string | null;
    recipients: number;
    read: number;
    done: number;
    createdAt: string;
    sender: string;
}

export interface AnnouncementsPage {
    total: number;
    page: number;
    limit: number;
    items: AnnouncementListItem[];
}

export interface AnnouncementDetail {
    id: number;
    kind: AnnouncementKind;
    title: string;
    body: string;
    linkPath: string | null;
    dueDate: string | null;
    recipientCount: number;
    remindedAt: string | null;
    createdAt: string;
    recipients: {
        userId: number;
        name: string;
        role: string;
        school: string | null;
        readAt: string | null;
        doneAt: string | null;
    }[];
}
