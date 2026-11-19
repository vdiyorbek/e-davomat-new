export type AssessmentType = 'CHSB' | 'BSB';
export type AssessmentStatus = 'GENERATING' | 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'FAILED';
export type AssessmentDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type StudentAssessmentState = 'UPCOMING' | 'OPEN' | 'IN_PROGRESS' | 'SUBMITTED' | 'MISSED';

export interface AssessmentListItem {
    id: number;
    assignmentId: number;
    class: { id: number; name: string };
    subject: { id: number; nameUz: string };
    type: AssessmentType;
    quarter: number | null;
    title: string;
    status: AssessmentStatus;
    questionCount: number;
    durationMinutes: number;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
    submitted: number;
    averagePercent: number | null;
}

export interface AssessmentTopic {
    id: number;
    textbookId: number;
    textbookTitle: string;
    orderIndex: number;
    chapterTitle: string | null;
    title: string;
    pageStart: number | null;
    pageEnd: number | null;
    taughtOn: string | null;
}

export interface AssessmentQuestion {
    id: number;
    orderIndex: number;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
    topicId: number | null;
}

export interface AssessmentDetail {
    id: number;
    teacherAssignmentId: number;
    type: AssessmentType;
    quarter: number | null;
    title: string;
    status: AssessmentStatus;
    questionCount: number;
    difficulty: AssessmentDifficulty;
    durationMinutes: number;
    startsAt: string | null;
    endsAt: string | null;
    aiModel: string | null;
    generationError: string | null;
    createdAt: string;
    class: { id: number; name: string };
    subject: { id: number; nameUz: string };
    school: { name: string };
    topics: { id: number; title: string; chapterTitle: string | null }[];
    questions: AssessmentQuestion[];
}

export interface AssessmentResults {
    assessment: { id: number; title: string; type: AssessmentType; status: AssessmentStatus; startsAt: string | null; endsAt: string | null };
    summary: {
        students: number;
        submitted: number;
        inProgress: number;
        averagePercent: number | null;
        grades: Record<'2' | '3' | '4' | '5', number>;
    };
    students: {
        personId: number;
        firstName: string;
        lastName: string;
        middleName: string | null;
        status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
        submittedAt: string | null;
        correctCount: number | null;
        totalCount: number;
        percent: number | null;
        grade: number | null;
    }[];
    questions: { id: number; orderIndex: number; text: string; answered: number; correctPercent: number | null }[];
}

export interface StudentAssessmentItem {
    id: number;
    title: string;
    type: AssessmentType;
    quarter: number | null;
    subject: string;
    durationMinutes: number;
    startsAt: string | null;
    endsAt: string | null;
    state: StudentAssessmentState;
    percent: number | null;
    grade: number | null;
}

export interface StudentAttemptSession {
    id: number;
    title: string;
    type: AssessmentType;
    durationMinutes: number;
    startedAt: string;
    deadlineAt: string;
    serverNow: string;
    answers: Record<string, number>;
    questions: { id: number; number: number; text: string; options: string[] }[];
}

export interface StudentAssessmentResult {
    id: number;
    title: string;
    type: AssessmentType;
    submittedAt: string;
    correctCount: number;
    totalCount: number;
    percent: number;
    grade: number;
    revealed: boolean;
    answersAvailableAt: string | null;
    questions: {
        id: number;
        number: number;
        text: string;
        options: string[];
        correctIndex: number;
        chosenIndex: number | null;
        explanation: string | null;
    }[];
}
