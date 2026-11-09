import { useId, useState } from 'react';
import { Download, FileSpreadsheet, Search, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/common/Field';
import { FileInput } from '@/components/common/FileInput';
import { SelectField } from '@/components/common/SelectField';
import { ErrorState } from '@/components/common/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import {
    downloadStudentImportTemplate,
    importSchoolStudents,
} from '@/lib/school-students-api';
import type { StudentImportReport } from '@/lib/school-students-api';
import type { School } from '@/types/school';

interface ImportStudentsFormProps {
    /** Hech narsa yuklanmagan holda yopish. */
    onClose: () => void;
    /** Kamida bitta o‘quvchi qo‘shilgandan keyin yopish (ro‘yxat yangilanadi). */
    onImported: () => void;
}

type Busy = 'template' | 'check' | 'apply' | null;

export function ImportStudentsForm({ onClose, onImported }: ImportStudentsFormProps) {
    const { t } = useTranslation();
    const id = useId();
    const { session } = useAuth();
    const ownSchool = session?.profile.role === 'SCHOOL_ADMIN';

    const schoolsQuery = useApiQuery<School[]>('/schools');
    const schools = schoolsQuery.data ?? [];

    const [schoolId, setSchoolId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<StudentImportReport | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState('');
    const [imported, setImported] = useState(false);

    const selectedSchoolId = ownSchool ? undefined : Number(schoolId);
    const schoolReady = ownSchool || schools.some((school) => String(school.id) === schoolId);

    function resetResult() {
        setReport(null);
        setError('');
    }

    async function handleTemplate() {
        if (busy) return;
        setBusy('template');
        setError('');

        try {
            const blob = await downloadStudentImportTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'oquvchilar-shabloni.xlsx';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (templateError: unknown) {
            setError(templateError instanceof ApiError ? templateError.message : t('members.import.templateFailed'));
        } finally {
            setBusy(null);
        }
    }

    async function run(apply: boolean) {
        if (busy) return;

        if (!schoolReady) {
            setError(t('members.errors.chooseSchool'));
            return;
        }

        if (!file) {
            setError(t('members.import.noFile'));
            return;
        }

        setBusy(apply ? 'apply' : 'check');
        setError('');

        try {
            const result = await importSchoolStudents(file, selectedSchoolId, apply);
            setReport(result);
            if (apply && result.created > 0) setImported(true);
        } catch (importError: unknown) {
            setError(importError instanceof ApiError ? importError.message : t('members.import.failed'));
        } finally {
            setBusy(null);
        }
    }

    const canApply = report !== null && !report.applied && report.valid > 0;

    return (
        <div className="space-y-5" aria-busy={busy !== null}>
            {error && <ErrorState message={error} />}

            <p className="text-sm leading-6 text-muted-foreground">{t('members.import.hint')}</p>

            <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                disabled={busy !== null}
                onClick={() => void handleTemplate()}
            >
                <Download aria-hidden="true" />
                {t('members.import.template')}
            </Button>

            {!ownSchool && (
                <Field
                    htmlFor={`${id}-school`}
                    label={t('common.school')}
                    required
                    error={schoolsQuery.error || undefined}
                >
                    <SelectField
                        id={`${id}-school`}
                        value={schoolId}
                        onValueChange={(value) => {
                            setSchoolId(value);
                            resetResult();
                        }}
                        required
                        searchable
                        disabled={busy !== null || schoolsQuery.loading || Boolean(schoolsQuery.error) || schools.length === 0}
                        placeholder={schoolsQuery.loading ? t('common.loading') : t('members.chooseSchool')}
                        options={schools.map((school) => ({
                            value: String(school.id),
                            label: `${school.name} — ${school.district.name}`,
                        }))}
                    />
                </Field>
            )}

            <Field htmlFor={`${id}-file`} label={t('members.import.file')} required>
                <FileInput
                    id={`${id}-file`}
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    file={file}
                    disabled={busy !== null || report?.applied === true}
                    icon={<FileSpreadsheet aria-hidden="true" />}
                    onFileChange={(selected) => {
                        setFile(selected);
                        resetResult();
                    }}
                />
            </Field>

            {report && (
                <section className="space-y-3">
                    <Alert>
                        <AlertDescription className="text-foreground">
                            {report.applied
                                ? t('members.import.summaryDone', { created: report.created, failed: report.failed })
                                : t('members.import.summaryCheck', {
                                    total: report.total,
                                    valid: report.valid,
                                    failed: report.failed,
                                })}
                            {!report.applied && report.failed === 0 && ` ${t('members.import.noErrors')}`}
                        </AlertDescription>
                    </Alert>

                    {report.errors.length > 0 && (
                        <div className="max-h-72 overflow-auto rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-20">{t('members.import.row')}</TableHead>
                                        <TableHead className="w-44">{t('common.pnfl')}</TableHead>
                                        <TableHead>{t('members.import.message')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.errors.map((item) => (
                                        <TableRow key={`${item.row}-${item.message}`}>
                                            <TableCell className="tabular-nums">{item.row}</TableCell>
                                            <TableCell className="font-mono tabular-nums">{item.pnfl || '—'}</TableCell>
                                            <TableCell className="whitespace-normal [overflow-wrap:anywhere]">{item.message}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </section>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={imported ? onImported : onClose}
                >
                    {imported || report?.applied ? t('common.close') : t('common.cancel')}
                </Button>

                {report?.applied !== true && (
                    <Button
                        type="button"
                        variant={canApply ? 'outline' : 'default'}
                        disabled={busy !== null || !file || !schoolReady}
                        onClick={() => void run(false)}
                    >
                        <Search aria-hidden="true" />
                        {busy === 'check' ? t('members.import.checking') : t('members.import.check')}
                    </Button>
                )}

                {canApply && (
                    <Button type="button" disabled={busy !== null} onClick={() => void run(true)}>
                        <Upload aria-hidden="true" />
                        {busy === 'apply'
                            ? t('members.import.applying')
                            : t('members.import.apply', { count: report.valid })}
                    </Button>
                )}
            </div>
        </div>
    );
}