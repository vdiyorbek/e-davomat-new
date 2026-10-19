
import { useState } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { TextbookUploadForm } from './TextbookUploadForm';
import { TextbookExtractButton } from './TextbookExtractButton';
import { TextbookTopicRow } from './TextbookTopicRow';

interface Textbook {
    id: number;
    subjectId: number;
    gradeLevel: number;
    title: string;
    languageCode: string;
    processingStatus: 'DRAFT' | 'PROCESSING' | 'READY' | 'FAILED';
    isVerified: boolean;
}

interface Subject {
    id: number;
    nameUz: string;
    isActive?: boolean;
}

interface TextbookTopic {
    id: number;
    orderIndex: number;
    chapterTitle: string | null;
    title: string;
    pageStart: number | null;
    pageEnd: number | null;
    reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

interface TopicsResponse {
    textbookId: number;
    textbookTitle: string;
    total: number;
    topics: TextbookTopic[];
}

const processingLabels: Record<Textbook['processingStatus'], string> = {
    DRAFT: 'Yangi',
    PROCESSING: 'Tahlil qilinmoqda',
    READY: 'Tahlil tugagan',
    FAILED: 'Tahlilda xatolik',
};


function TopicsList({
    textbookId,
    onUpdated,
}: {
    textbookId: number;
    onUpdated: () => void;
}) {
    const query = useApiQuery<TopicsResponse>(
        `/textbooks/${textbookId}/topics`,
    );

    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">
                        {query.data?.textbookTitle ?? 'Darslik mavzulari'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Jami mavzular: {query.data?.total ?? '—'}
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={query.retry}
                    disabled={query.loading}
                >
                    <RefreshCw className="size-4" />
                    Yangilash
                </Button>
            </div>

            {query.loading ? (
                <p className="text-sm text-muted-foreground">
                    Mavzular yuklanmoqda…
                </p>
            ) : query.error ? (
                <p role="alert" className="text-sm text-destructive">
                    {query.error}
                </p>
            ) : !query.data?.topics.length ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Ushbu darslikning mavzulari hali ajratilmagan.
                    </p>

                    <TextbookExtractButton
                        textbookId={textbookId}
                        onExtracted={() => {
                            query.retry();
                            onUpdated();
                        }}
                    />
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3">№</th>
                                <th className="px-4 py-3">Bob</th>
                                <th className="px-4 py-3">Mavzu</th>
                                <th className="px-4 py-3">Sahifalar</th>
                                <th className="px-4 py-3">Holati</th>
                                <th className="px-4 py-3">Amallar</th>
                            </tr>
                        </thead>

                        <tbody>
                            {query.data.topics.map((topic) => (
                                <TextbookTopicRow
                                    key={topic.id}
                                    topic={topic}
                                    onUpdated={query.retry}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export function TextbooksPage() {
    const textbooksQuery = useApiQuery<Textbook[]>('/textbooks');
    const subjectsQuery = useApiQuery<Subject[]>('/subjects');

    const [selectedId, setSelectedId] = useState<number | null>(null);

    const textbooks = textbooksQuery.data ?? [];
    const subjects = subjectsQuery.data ?? [];

    function subjectName(subjectId: number): string {
        return (
            subjects.find((subject) => subject.id === subjectId)?.nameUz ??
            `Fan #${subjectId}`
        );
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                eyebrow="Elektron ta’lim"
                title="Darsliklar kutubxonasi"
                description="PDF darsliklar va Gemini yordamida ajratilgan mavzularni boshqarish."
                actions={<BookOpen className="size-7 text-primary" />}
            />
            {subjectsQuery.error && (
                <p role="alert" className="text-sm text-destructive">
                    Fanlarni yuklashda xatolik: {subjectsQuery.error}
                </p>
            )}

            <TextbookUploadForm
                subjects={subjects.filter((item) => item.isActive !== false)}
                onUploaded={textbooksQuery.retry}
            />
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Yuklangan darsliklar
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Ko‘rsatilmoqda: {textbooks.length}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={textbooksQuery.retry}
                        disabled={textbooksQuery.loading}
                    >
                        <RefreshCw className="size-4" />
                        Yangilash
                    </Button>
                </div>

                {textbooksQuery.loading ? (
                    <p className="text-sm text-muted-foreground">
                        Darsliklar yuklanmoqda…
                    </p>
                ) : textbooksQuery.error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {textbooksQuery.error}
                    </p>
                ) : textbooks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Hozircha darslik yuklanmagan.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">Darslik</th>
                                    <th className="px-4 py-3">Fan</th>
                                    <th className="px-4 py-3">Sinf</th>
                                    <th className="px-4 py-3">Til</th>
                                    <th className="px-4 py-3">Tahlil holati</th>
                                    <th className="px-4 py-3">Amal</th>
                                </tr>
                            </thead>

                            <tbody>
                                {textbooks.map((textbook) => (
                                    <tr
                                        key={textbook.id}
                                        className="border-t border-border"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {textbook.title}
                                        </td>

                                        <td className="px-4 py-3">
                                            {subjectName(textbook.subjectId)}
                                        </td>

                                        <td className="px-4 py-3">
                                            {textbook.gradeLevel}-sinf
                                        </td>

                                        <td className="px-4 py-3">
                                            {textbook.languageCode}
                                        </td>

                                        <td className="px-4 py-3">
                                            {processingLabels[textbook.processingStatus]}
                                        </td>

                                        <td className="px-4 py-3">
                                            <Button
                                                type="button"
                                                variant={
                                                    selectedId === textbook.id
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                size="sm"
                                                onClick={() =>
                                                    setSelectedId(
                                                        selectedId === textbook.id
                                                            ? null
                                                            : textbook.id,
                                                    )
                                                }
                                            >
                                                {selectedId === textbook.id
                                                    ? 'Yopish'
                                                    : 'Mavzular'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {selectedId !== null && (
                <TopicsList
                    key={selectedId}
                    textbookId={selectedId}
                    onUpdated={textbooksQuery.retry}
                />
            )}
        </div>
    );
}
