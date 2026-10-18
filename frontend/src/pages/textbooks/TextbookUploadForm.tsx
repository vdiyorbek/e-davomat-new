
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FileUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorizedPost } from '@/lib/auth-session';

interface Subject {
    id: number;
    nameUz: string;
}

interface Props {
    subjects: Subject[];
    onUploaded: () => void;
}

const fieldStyle =
    'mt-2 h-11 w-full rounded-xl border border-input ' +
    'bg-background px-3 text-sm';

export function TextbookUploadForm({
    subjects,
    onUploaded,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);

    const [subjectId, setSubjectId] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [title, setTitle] = useState('');
    const [languageCode, setLanguageCode] = useState('uz-Latn');
    const [file, setFile] = useState<File | null>(null);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        setError('');
        setSuccess('');

        if (!file || !subjectId || !gradeLevel || !title.trim()) {
            setError('Barcha majburiy maydonlarni to‘ldiring.');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setError('Faqat PDF fayl yuklash mumkin.');
            return;
        }

        if (file.size > 30 * 1024 * 1024) {
            setError('PDF hajmi 30 MB dan oshmasligi kerak.');
            return;
        }

        const data = new FormData();

        data.append('subjectId', subjectId);
        data.append('gradeLevel', gradeLevel);
        data.append('title', title.trim());
        data.append('languageCode', languageCode);
        data.append('file', file);

        setBusy(true);

        try {
            const result = await authorizedPost<{
                id: number;
                title: string;
            }>('/textbooks/upload', data);

            setSuccess(
                `"${result.title}" darsligi muvaffaqiyatli yuklandi. ID: ${result.id}`,
            );

            setTitle('');
            setFile(null);

            if (fileRef.current) {
                fileRef.current.value = '';
            }

            onUploaded();
        } catch (caught: unknown) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'PDF yuklashda xatolik yuz berdi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div>
                <h2 className="text-lg font-semibold">
                    Yangi PDF darslik qo‘shish
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Darslikni yuklang, keyin Gemini orqali mavzularini ajrating.
                </p>
            </div>

            <form
                onSubmit={(event) => void handleSubmit(event)}
                className="space-y-4"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium">
                        Fan
                        <select
                            className={fieldStyle}
                            value={subjectId}
                            onChange={(event) => setSubjectId(event.target.value)}
                            disabled={busy}
                            required
                        >
                            <option value="">Fanni tanlang</option>

                            {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                    {subject.nameUz}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm font-medium">
                        Sinf
                        <select
                            className={fieldStyle}
                            value={gradeLevel}
                            onChange={(event) => setGradeLevel(event.target.value)}
                            disabled={busy}
                            required
                        >
                            <option value="">Sinfni tanlang</option>

                            {Array.from({ length: 12 }, (_, index) => index + 1).map(
                                (grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}-sinf
                                    </option>
                                ),
                            )}
                        </select>
                    </label>

                    <label className="text-sm font-medium">
                        Darslik nomi
                        <Input
                            className="mt-2"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Masalan: Algebra 8-sinf"
                            maxLength={255}
                            minLength={2}
                            disabled={busy}
                            required
                        />
                    </label>

                    <label className="text-sm font-medium">
                        Darslik tili
                        <select
                            className={fieldStyle}
                            value={languageCode}
                            onChange={(event) => setLanguageCode(event.target.value)}
                            disabled={busy}
                        >
                            <option value="uz-Latn">O‘zbek — lotin</option>
                            <option value="uz-Cyrl">O‘zbek — kirill</option>
                            <option value="ru">Rus tili</option>
                        </select>
                    </label>
                </div>

                <label className="block text-sm font-medium">
                    PDF fayl (maksimal 30 MB)
                    <Input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="mt-2"
                        onChange={(event) => {
                            setFile(event.target.files?.[0] ?? null);
                        }}
                        disabled={busy}
                        required
                    />
                </label>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {success && (
                    <p role="status" className="text-sm text-green-600">
                        {success}
                    </p>
                )}

                <Button
                    type="submit"
                    disabled={busy || subjects.length === 0}
                >
                    <FileUp className="size-4" />
                    {busy ? 'Yuklanmoqda…' : 'PDF darslikni yuklash'}
                </Button>
            </form>
        </section>
    );
}
