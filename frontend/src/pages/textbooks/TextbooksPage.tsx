import { useState } from 'react';
import { BookOpen, CheckCheck, ListTree, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailItem, DetailList } from '@/components/common/ResponsiveDetails';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { authorizedPatch } from '@/lib/auth-session';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { localizedName } from '@/lib/localized';
import { TextbookEditForm } from './TextbookEditForm';
import { TextbookExtractButton } from './TextbookExtractButton';
import { TextbookTopicRow } from './TextbookTopicRow';
import type { TextbookTopic } from './TextbookTopicRow';
import { TextbookArchiveButton } from './TextbookArchiveButton';
import { TextbookPdfViewer } from './TextbookPdfViewer';
import { TextbookUploadForm } from './TextbookUploadForm';

interface Textbook {
    id: number;
    subjectId: number;
    gradeLevel: number;
    title: string;
    languageCode: string;

    publisher: string | null;
    publicationYear: number | null;
    approvalReference: string | null;

    processingStatus: 'DRAFT' | 'PROCESSING' | 'READY' | 'FAILED';
    isVerified: boolean;
    isActive: boolean;
    updatedAt?: string;
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

function TopicsList({
    textbookId,
    onUpdated,
    onOpenPage,
}: {
    textbookId: number;
    onUpdated: () => void;
    onOpenPage: (page: number) => void;
}) {
    const { t } = useTranslation();
    const query = useApiQuery<TopicsResponse>(`/textbooks/${textbookId}/topics`);

    const { confirm, dialog } = useConfirm();
    const [approving, setApproving] = useState(false);
    const [approveError, setApproveError] = useState('');

    const pendingCount = (query.data?.topics ?? []).filter(
        (topic) => topic.reviewStatus === 'PENDING_REVIEW'
    ).length;

    async function approveAll() {
        if (approving || pendingCount === 0) return;

        const confirmed = await confirm({
            title: t('textbooks.topics.approveAllTitle'),
            description: t('textbooks.topics.approveAllConfirm', { count: pendingCount }),
            confirmLabel: t('textbooks.topics.approveAll'),
        });

        if (!confirmed) return;

        setApproving(true);
        setApproveError('');

        try {
            await authorizedPatch(
                `/textbooks/${textbookId}/topics/approve-all`,
                {},
            );

            query.retry();
            onUpdated();
        } catch (error: unknown) {
            setApproveError(
                error instanceof Error
                    ? error.message
                    : t('textbooks.topics.errors.approveAllFailed')
            );
        } finally {
            setApproving(false);
        }
    }

    return (
        <div className="space-y-4">
            {dialog}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('textbooks.topics.total', { count: query.data?.total ?? 0 })}</p>
                <div className="flex flex-wrap gap-2">
                    {pendingCount > 0 && (
                        <Button type="button" size="sm" disabled={approving} onClick={() => void approveAll()}>
                            <CheckCheck aria-hidden="true" />
                            {approving ? t('textbooks.topics.approving') : t('textbooks.topics.approveAllN', { count: pendingCount })}
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={query.retry} disabled={query.loading}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>

            {approveError && <ErrorState message={approveError} />}

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
                            <TextbookTopicRow
                                key={topic.id}
                                topic={topic}
                                onUpdated={query.retry}
                                onOpenPage={onOpenPage}
                            />
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
    const [pdfTarget, setPdfTarget] = useState<{
        textbookId: number;
        title: string;
        page: number;
    } | null>(null);
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'active' | 'archived'
    >('active');
    const textbooks = textbooksQuery.data ?? [];
    const subjects = subjectsQuery.data ?? [];
    const visibleTextbooks = textbooks.filter((textbook) => {
        if (statusFilter === 'active') return textbook.isActive;
        if (statusFilter === 'archived') return !textbook.isActive;
        return true;
    });

    function subjectName(subjectId: number): string {
        const subject = subjects.find((item) => item.id === subjectId);
        return subject ? localizedName(subject) : t('textbooks.subjectN', { id: subjectId });
    }

    function statusBadge(textbook: Textbook) {
        if (!textbook.isActive) {
            return <StatusBadge tone="neutral">{t('textbooks.archived')}</StatusBadge>;
        }

        return (
            <StatusBadge tone={PROCESSING_TONE[textbook.processingStatus]}>
                {t(`textbooks.processing.${textbook.processingStatus}`)}
            </StatusBadge>
        );
    }


    function textbookActions(textbook: Textbook) {
        return (
            <div className="flex flex-wrap items-center justify-end gap-2">
                <TextbookPdfViewer
                    textbookId={textbook.id}
                    title={textbook.title}
                />

                {textbook.isActive && (
                    <TextbookEditForm
                        key={textbook.id}
                        textbook={textbook}
                        subjects={subjects}
                        onUpdated={textbooksQuery.retry}
                    />
                )}

                {textbook.isActive && topicsButton(textbook)}

                <TextbookArchiveButton
                    textbook={textbook}
                    onUpdated={textbooksQuery.retry}
                />
            </div>
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
                        <p className="text-sm text-muted-foreground">{t('common.total', { count: visibleTextbooks.length })}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={textbooksQuery.retry} disabled={textbooksQuery.loading}>
                        <RotateCw aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <TabsList>
                        <TabsTrigger value="active">{t('textbooks.active')}</TabsTrigger>
                        <TabsTrigger value="archived">{t('textbooks.archived')}</TabsTrigger>
                        <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                    </TabsList>
                </Tabs>

                {textbooksQuery.loading ? (
                    <LoadingState />
                ) : textbooksQuery.error ? (
                    <ErrorState message={textbooksQuery.error} onRetry={textbooksQuery.retry} />
                ) : visibleTextbooks.length === 0 ? (
                    <EmptyState icon={BookOpen} title={t('textbooks.emptyTitle')} description={t('textbooks.empty')} />
                ) : (
                    <>
                        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:hidden">
                            {visibleTextbooks.map((textbook) => (
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
                                        <div className="mt-auto border-t pt-3">
                                            {textbookActions(textbook)}
                                        </div>
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
                                    {visibleTextbooks.map((textbook) => (
                                        <TableRow key={textbook.id}>
                                            <TableCell className="max-w-72 pl-5 font-semibold whitespace-normal">{textbook.title}</TableCell>
                                            <TableCell>{subjectName(textbook.subjectId)}</TableCell>
                                            <TableCell>{t('calendar.gradeN', { grade: textbook.gradeLevel })}</TableCell>
                                            <TableCell>{t(`textbooks.languages.${textbook.languageCode}`, { defaultValue: textbook.languageCode })}</TableCell>
                                            <TableCell>{statusBadge(textbook)}</TableCell>
                                            <TableCell className="pr-5 text-right">
                                                {textbookActions(textbook)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </>
                )}
            </section>

            <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent
                    side="right"
                    className="w-full min-w-0 gap-0 overflow-y-auto sm:!max-w-[min(900px,95vw)]"
                >
                    <SheetHeader className="border-b p-5 pr-12">
                        <SheetTitle className="font-heading text-lg">{selected?.title}</SheetTitle>
                        <SheetDescription>{t('textbooks.topics.sheetHint')}</SheetDescription>
                    </SheetHeader>
                    <div className="p-4 sm:p-5">
                        {selected && (
                            <TopicsList
                                key={selected.id}
                                textbookId={selected.id}
                                onUpdated={textbooksQuery.retry}
                                onOpenPage={(page) => {
                                    setPdfTarget({
                                        textbookId: selected.id,
                                        title: selected.title,
                                        page,
                                    });

                                    setSelected(null);
                                }}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
            {pdfTarget && (
                <TextbookPdfViewer
                    key={`${pdfTarget.textbookId}-${pdfTarget.page}`}
                    textbookId={pdfTarget.textbookId}
                    title={pdfTarget.title}
                    page={pdfTarget.page}
                    open={true}
                    showTrigger={false}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPdfTarget(null);
                        }
                    }}
                />
            )}
        </div>
    );
}
