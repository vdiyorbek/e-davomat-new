export type LessonSessionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TeacherCabinetLesson {
    date: string;
    lessonScheduleId: number;
    assignmentId: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    school: { id: number; name: string };
    class: { id: number; name: string; gradeLevel: number | null };
    subject: { id: number; nameUz: string };
    session: {
        id: number;
        status: LessonSessionStatus;
        topicTitle: string | null;
        textbookTopicId: number | null;
        homework: string | null;
    } | null;
}

export interface StudentLesson {
    date: string;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    status: LessonSessionStatus | null;
    topicTitle: string | null;
    homework: string | null;
}

export interface StudentOverview {
    profile: {
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        schoolName: string;
        className: string;
        gradeLevel: number | null;
        academicYear: string;
    };
    shift: { code: number; name: string; startTime: string; endTime: string } | null;
    today: string;
    lessons: StudentLesson[];
    homework: StudentLesson[];
    attendance: { firstInTime: string | null; lastOutTime: string | null } | null;
}

export interface StudentAttendance {
    from: string;
    to: string;
    days: {
        date: string;
        firstInTime: string | null;
        lastOutTime: string | null;
        status: 'PRESENT' | 'EXCUSED' | 'ABSENT';
    }[];
}

export interface TeacherLoad {
    date: string;
    teachers: {
        teacherMembershipId: number;
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        plannedHours: number;
        scheduledHours: number;
        byDay: number[];
        assignments: {
            id: number;
            classId: number;
            className: string;
            subjectId: number;
            subjectName: string;
            weeklyHours: number | null;
            scheduled: number;
        }[];
    }[];
}
