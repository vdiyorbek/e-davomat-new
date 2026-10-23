
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authorizedPatch } from '@/lib/auth-session';
import { localizedName } from '@/lib/localized';

export interface EditableTextbook {
    id: number;
    subjectId: number;
    gradeLevel: number;
    title: string;
    languageCode: string;
    publisher?: string | null;
    publicationYear?: number | null;
    approvalReference?: string | null;
    isActive?: boolean;
}

interface Subject {
    id: number;
    nameUz: string;
    isActive?: boolean;
}

interface Props {
    textbook: EditableTextbook;
    subjects: Subject[];
    onUpdated: () => void;
}

const GRADES = Array.from(
    { length: 12 },
    (_, index) => String(index + 1),
);

const LANGUAGES = ['uz-Latn', 'uz-Cyrl', 'ru'] as const;

export function TextbookEditForm({
    textbook,
    subjects,
    onUpdated,
}: Props) {
    const { t } = useTranslation();
    const id = useId();

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [subjectId, setSubjectId] = useState(
        String(textbook.subjectId),
    );
    const [gradeLevel, setGradeLevel] = useState(
        String(textbook.gradeLevel),
    );
    const [title, setTitle] = useState(textbook.title);
    const [languageCode, setLanguageCode] = useState(
        textbook.languageCode,
    );
    const [publisher, setPublisher] = useState(
        textbook.publisher ?? '',
    );
    const [publicationYear, setPublicationYear] = useState(
        textbook.publicationYear?.toString() ?? '',
    );
    const [approvalReference, setApprovalReference] = useState(
        textbook.approvalReference ?? '',
    );

    function startEditing() {
        setSubjectId(String(textbook.subjectId));
        setGradeLevel(String(textbook.gradeLevel));
        setTitle(textbook.title);
        setLanguageCode(textbook.languageCode);
        setPublisher(textbook.publisher ?? '');
        setPublicationYear(
            textbook.publicationYear?.toString() ?? '',
        );
        setApprovalReference(
            textbook.approvalReference ?? '',
        );
        setError('');
        setOpen(true);
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (busy) return;

        setError('');

        const cleanTitle = title.trim();

        if (cleanTitle.length < 2 || cleanTitle.length > 255) {
            setError(t('textbooks.edit.errors.title'));
            return;
        }

        const nextSubjectId = Number(subjectId);
        const nextGradeLevel = Number(gradeLevel);

        if (
            !Number.isSafeInteger(nextSubjectId) ||
            nextSubjectId < 1 ||
            !Number.isSafeInteger(nextGradeLevel) ||
            nextGradeLevel < 1 ||
            nextGradeLevel > 12
        ) {
            setError(t('textbooks.edit.errors.subjectGrade'));
            return;
        }

        const yearText = publicationYear.trim();
        const year = yearText ? Number(yearText) : null;

        if (
            year !== null &&
            (!Number.isInteger(year) || year < 1900 || year > 2100)
        ) {
            setError(t('textbooks.edit.errors.year'));
            return;
        }

        const cleanPublisher = publisher.trim();
        const cleanApproval = approvalReference.trim();

        if (cleanPublisher.length > 200) {
            setError(t('textbooks.edit.errors.publisher'));
            return;
        }

        if (cleanApproval.length > 300) {
            setError(t('textbooks.edit.errors.approval'));
            return;
        }

        setBusy(true);

        try {
            await authorizedPatch(`/textbooks/${textbook.id}`, {
                subjectId: nextSubjectId,
                gradeLevel: nextGradeLevel,
                title: cleanTitle,
                languageCode,
                publisher: cleanPublisher || null,
                publicationYear: year,
                approvalReference: cleanApproval || null,
            });

            setOpen(false);
            onUpdated();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : t('textbooks.edit.errors.saveFailed'),
            );
        } finally {
            setBusy(false);
        }
    }

    const subjectOptions = subjects
        .filter(
            (subject) =>
                subject.isActive !== false ||
                subject.id === textbook.subjectId,
        )
        .map((subject) => ({
            value: String(subject.id),
            label: localizedName(subject),
        }));

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startEditing}
            >
                <Pencil aria-hidden="true" />
                {t('common.edit')}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(nextOpen) => {
                    if (!busy) setOpen(nextOpen);
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('textbooks.edit.title')}</DialogTitle>

                        <DialogDescription>{t('textbooks.edit.hint')}</DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="space-y-4"
                    >
                        <fieldset
                            disabled={busy}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            <div className="sm:col-span-2">
                                <Field
                                    htmlFor={`${id}-title`}
                                    label={t('textbooks.upload.name')}
                                    required
                                >
                                    <Input
                                        id={`${id}-title`}
                                        value={title}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                        minLength={2}
                                        maxLength={255}
                                        required
                                    />
                                </Field>
                            </div>

                            <Field
                                htmlFor={`${id}-subject`}
                                label={t('assignments.subject')}
                                required
                            >
                                <SelectField
                                    id={`${id}-subject`}
                                    value={subjectId}
                                    onValueChange={setSubjectId}
                                    options={subjectOptions}
                                    placeholder={t('assignments.chooseSubject')}
                                    required
                                />
                            </Field>

                            <Field
                                htmlFor={`${id}-grade`}
                                label={t('common.class')}
                                required
                            >
                                <SelectField
                                    id={`${id}-grade`}
                                    value={gradeLevel}
                                    onValueChange={setGradeLevel}
                                    options={GRADES.map((grade) => ({
                                        value: grade,
                                        label: t('calendar.gradeN', {
                                            grade,
                                        }),
                                    }))}
                                    required
                                />
                            </Field>

                            <Field
                                htmlFor={`${id}-language`}
                                label={t('textbooks.upload.language')}
                                required
                            >
                                <SelectField
                                    id={`${id}-language`}
                                    value={languageCode}
                                    onValueChange={setLanguageCode}
                                    options={LANGUAGES.map((code) => ({
                                        value: code,
                                        label: t(`textbooks.languages.${code}`),
                                    }))}
                                    required
                                />
                            </Field>

                            <Field
                                htmlFor={`${id}-year`}
                                label={t('textbooks.edit.year')}
                            >
                                <Input
                                    id={`${id}-year`}
                                    type="number"
                                    min={1900}
                                    max={2100}
                                    step={1}
                                    value={publicationYear}
                                    onChange={(event) =>
                                        setPublicationYear(event.target.value)
                                    }
                                    placeholder="2026"
                                />
                            </Field>

                            <div className="sm:col-span-2">
                                <Field
                                    htmlFor={`${id}-publisher`}
                                    label={t('textbooks.edit.publisher')}
                                >
                                    <Input
                                        id={`${id}-publisher`}
                                        value={publisher}
                                        onChange={(event) =>
                                            setPublisher(event.target.value)
                                        }
                                        maxLength={200}
                                        placeholder={t('textbooks.edit.publisherPlaceholder')}
                                    />
                                </Field>
                            </div>

                            <div className="sm:col-span-2">
                                <Field
                                    htmlFor={`${id}-approval`}
                                    label={t('textbooks.edit.approval')}
                                >
                                    <Input
                                        id={`${id}-approval`}
                                        value={approvalReference}
                                        onChange={(event) =>
                                            setApprovalReference(event.target.value)
                                        }
                                        maxLength={300}
                                        placeholder={t('textbooks.edit.approvalPlaceholder')}
                                    />
                                </Field>
                            </div>
                        </fieldset>

                        {error && <ErrorState message={error} />}

                        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setOpen(false)}
                            >
                                {t('common.cancel')}
                            </Button>

                            <Button type="submit" disabled={busy}>
                                <Save aria-hidden="true" />
                                {busy
                                    ? t('common.saving')
                                    : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
