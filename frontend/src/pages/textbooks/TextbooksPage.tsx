import { useState } from 'react';
import { BookOpen, ListTree, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/common/PageHeader';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { localizedName } from '@/lib/localized';

import { TextbookExtractButton } from './TextbookExtractButton';
import { TextbookTopicRow } from './TextbookTopicRow';
import type { TextbookTopic } from './TextbookTopicRow';
import { TextbookUploadForm } from './TextbookUploadForm';

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

interface TopicsResponse {
    textbookId: number;
    textbookTitle: string;
    total: number;
    topics: TextbookTopic[];
}

const PROCESSING_TONE = { DRAFT: 'neutral', PROCESSING: 'warning', READY: 'success', FAILED: 'danger' } as const;

function TopicsList({ textbookId, onUpdated }: { textbookId: number; onUpdated: () => void }) {
    const { t } = useTranslation();
    const query = useApiQuery<TopicsResponse>(`/textbooks/${textbookId}/topics`);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('textbooks.topics.total', { count: query.data?.total ?? 0 })}</p>
                <Button type="button" variant="outline" size="sm" onClick={query.retry} disabled={query.loading}>
                    <RotateCw aria-hidden="true" />
                    {t('common.refresh')}
                </Button>
            </div>

            {query.loading ? (
                <LoadingState rows={5} />
            ) : query.error ? (
                <ErrorState message={query.error} onRetry={query.retry} />
            ) : !query.data?.topics.length ? (
                <EmptyState
                    icon={ListTree}
                    title={t('textbooks.topics.emptyTitle')}
                    description={t('textbooks.topics.empty')}
                    action={
                        <TextbookExtractButton
                            textbookId={textbookId}
                            onExtracted={() => {
                                query.retry();
                                onUpdated();
                            }}
                        />
                    }
                />
            ) : (
                <Card className="py-0">
                    <ul className="divide-y">
                        {query.data.topics.map((topic) => (
                            <TextbookTopicRow key={topic.id} topic={topic} onUpdated={query.retry} />
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

export function TextbooksPage() {
    const { t } = useTranslation();
    const textbooksQuery = useApiQuery<Textbook[]>('/textbooks');
    const subjectsQuery = useApiQuery<Subject[]>('/subjects');
    const [selected, setSelected] = useState<Textbook | null>(null);

    const textbooks = textbooksQuery.data ?? [];
    const subjects = subjectsQuery.data ?? [];

    function subjectName(subjectId: number): string {
        const subject = subjects.find((item) => item.id === subjectId);
        return subject ? localizedName(subject) : t('textbooks.subjectN', { id: subjectId });
    }

    function statusBadge(textbook: Textbook) {
        return (
            <StatusBadge tone={PROCESSING_TONE[textbook.processingStatus]}>
                {t(`textbooks.processing.${textbook.processingStatus}`)}
            </StatusBadge>
        );
    }

    function topicsButton(textbook: Textbook) {
        return (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(textbook)}>
                <ListTree aria-hidden="true" />
                {t('textbooks.topicsButton')}
            </Button>
        );
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader eyebrow={t('nav.groups.education')} title={t('textbooks.title')} description={t('textbooks.subtitle')} />

            {subjectsQuery.error && <ErrorState message={`${t('assignments.subjects')}: ${subjectsQuery.error}`} onRetry={subjectsQuery.retry} />}

            <TextbookUploadForm subjects={subjects.filter((item) => item.isActive !== false)} onUploaded={textbooksQuery.retry} />

            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-heading text-lg font-semibold">{t('textbooks.listTitle')}</h2>
                        <p className="text-sm text-muted-foreground">{t('common.total', { count: textbooks.length })}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={textbooksQuery.retry} disabled={textbooksQuery.loading}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {textbooksQuery.loading ? (
                    <LoadingState />
                ) : textbooksQuery.error ? (
                    <ErrorState message={textbooksQuery.error} onRetry={textbooksQuery.retry} />
                ) : textbooks.length === 0 ? (
                    <EmptyState icon={BookOpen} title={t('textbooks.emptyTitle')} description={t('textbooks.empty')} />
                ) : (
                    <>
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {textbooks.map((textbook) => (
                                <li key={textbook.id}>
                                    <Card size="sm" className="h-full gap-3 px-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold [overflow-wrap:anywhere]">{textbook.title}</p>
                                            {statusBadge(textbook)}
                                        </div>
                                        <DetailList>
                                            <DetailItem label={t('assignments.subject')}>{subjectName(textbook.subjectId)}</DetailItem>
                                            <DetailItem label={t('common.class')}>{t('calendar.gradeN', { grade: textbook.gradeLevel })}</DetailItem>
                                            <DetailItem label={t('textbooks.upload.language')}>
                                                {t(`textbooks.languages.${textbook.languageCode}`, { defaultValue: textbook.languageCode })}
                                            </DetailItem>
                                        </DetailList>
                                        <div className="mt-auto border-t pt-3">{topicsButton(textbook)}</div>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                        <Card className="hidden py-0 xl:flex">
                            <Table className="min-w-[760px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-5">{t('textbooks.textbook')}</TableHead>
                                        <TableHead>{t('assignments.subject')}</TableHead>
                                        <TableHead>{t('common.class')}</TableHead>
                                        <TableHead>{t('textbooks.upload.language')}</TableHead>
                                        <TableHead>{t('textbooks.processingLabel')}</TableHead>
                                        <TableHead className="pr-5 text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {textbooks.map((textbook) => (
                                        <TableRow key={textbook.id}>
                                            <TableCell className="max-w-72 pl-5 font-semibold whitespace-normal">{textbook.title}</TableCell>
                                            <TableCell>{subjectName(textbook.subjectId)}</TableCell>
                                            <TableCell>{t('calendar.gradeN', { grade: textbook.gradeLevel })}</TableCell>
                                            <TableCell>{t(`textbooks.languages.${textbook.languageCode}`, { defaultValue: textbook.languageCode })}</TableCell>
                                            <TableCell>{statusBadge(textbook)}</TableCell>
                                            <TableCell className="pr-5 text-right">{topicsButton(textbook)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                )}
            </section>

            <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
                    <SheetHeader className="border-b p-5 pr-12">
                        <SheetTitle className="font-heading text-lg">{selected?.title}</SheetTitle>
                        <SheetDescription>{t('textbooks.topics.sheetHint')}</SheetDescription>
                    </SheetHeader>
                    <div className="p-4 sm:p-5">
                        {selected && <TopicsList key={selected.id} textbookId={selected.id} onUpdated={textbooksQuery.retry} />}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
