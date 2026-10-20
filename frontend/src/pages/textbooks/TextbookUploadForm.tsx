import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, FileUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { FileInput } from '@/components/common/FileInput';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState, SuccessNotice } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';
import { localizedName } from '@/lib/localized';

interface Subject {
    id: number;
    nameUz: string;
}

interface Props {
    subjects: Subject[];
    onUploaded: () => void;
}

const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));
const BOOK_LANGUAGES = ['uz-Latn', 'uz-Cyrl', 'ru'] as const;

export function TextbookUploadForm({ subjects, onUploaded }: Props) {
    const { t } = useTranslation();
    const id = useId();
    const [subjectId, setSubjectId] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [title, setTitle] = useState('');
    const [languageCode, setLanguageCode] = useState<string>('uz-Latn');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setError('');
        setSuccess('');

        if (!file || !subjectId || !gradeLevel || !title.trim()) return setError(t('textbooks.upload.errors.required'));
        if (!file.name.toLowerCase().endsWith('.pdf')) return setError(t('excuses.errors.fileType'));
        if (file.size > 30 * 1024 * 1024) return setError(t('excuses.errors.fileSize', { size: 30 }));

        const data = new FormData();
        data.append('subjectId', subjectId);
        data.append('gradeLevel', gradeLevel);
        data.append('title', title.trim());
        data.append('languageCode', languageCode);
        data.append('file', file);

        setBusy(true);
        try {
            const result = await authorizedPost<{ id: number; title: string }>('/textbooks/upload', data);
            setSuccess(t('textbooks.upload.success', { title: result.title, id: result.id }));
            setTitle('');
            setFile(null);
            onUploaded();
        } catch (caught: unknown) {
            setError(caught instanceof Error ? caught.message : t('textbooks.upload.errors.failed'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold">{t('textbooks.upload.title')}</CardTitle>
                <CardDescription>{t('textbooks.upload.hint')}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Field htmlFor={`${id}-subject`} label={t('assignments.subject')} required>
                            <SelectField
                                id={`${id}-subject`}
                                value={subjectId}
                                onValueChange={setSubjectId}
                                required
                                placeholder={t('assignments.chooseSubject')}
                                options={subjects.map((subject) => ({ value: String(subject.id), label: localizedName(subject) }))}
                            />
                        </Field>
                        <Field htmlFor={`${id}-grade`} label={t('common.class')} required>
                            <SelectField
                                id={`${id}-grade`}
                                value={gradeLevel}
                                onValueChange={setGradeLevel}
                                required
                                placeholder={t('classes.chooseGrade')}
                                options={GRADES.map((grade) => ({ value: grade, label: t('calendar.gradeN', { grade }) }))}
                            />
                        </Field>
                        <Field htmlFor={`${id}-title`} label={t('textbooks.upload.name')} required>
                            <Input
                                id={`${id}-title`}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder={t('textbooks.upload.namePlaceholder')}
                                maxLength={255}
                                minLength={2}
                                required
                            />
                        </Field>
                        <Field htmlFor={`${id}-lang`} label={t('textbooks.upload.language')}>
                            <SelectField
                                id={`${id}-lang`}
                                value={languageCode}
                                onValueChange={setLanguageCode}
                                options={BOOK_LANGUAGES.map((code) => ({ value: code, label: t(`textbooks.languages.${code}`) }))}
                            />
                        </Field>
                        <Field htmlFor={`${id}-file`} label={t('textbooks.upload.file')} hint={t('excuses.fileHint', { size: 30 })} required className="sm:col-span-2 xl:col-span-4">
                            <FileInput
                                id={`${id}-file`}
                                accept=".pdf,application/pdf"
                                file={file}
                                onFileChange={setFile}
                                icon={<FileText aria-hidden="true" />}
                                buttonLabel={t('excuses.chooseFile')}
                            />
                        </Field>
                    </fieldset>

                    {error && <ErrorState message={error} />}
                    {success && <SuccessNotice>{success}</SuccessNotice>}

                    <Button type="submit" disabled={busy || subjects.length === 0} className="w-full sm:w-auto">
                        <FileUp aria-hidden="true" />
                        {busy ? t('common.loading') : t('textbooks.upload.submit')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
