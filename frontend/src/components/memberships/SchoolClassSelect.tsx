import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';

interface SchoolClass {
    id: number;
    name: string;
    academicYear: string;
}

interface Props {
    schoolId: number;
    academicYear: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function SchoolClassSelect({
    schoolId,
    academicYear,
    value,
    onChange,
    disabled = false,
}: Props) {
    const params = new URLSearchParams({
        schoolId: String(schoolId),
        academicYear,
    });

    const query = useApiQuery<SchoolClass[]>(
        `/classes?${params.toString()}`,
    );

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium">
                Sinf
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    required
                    disabled={
                        disabled ||
                        query.loading ||
                        Boolean(query.error) ||
                        !query.data?.length
                    }
                    className="mt-2 h-12 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
                >
                    <option value="">
                        {query.loading
                            ? 'Yuklanmoqda…'
                            : 'Sinfni tanlang'}
                    </option>

                    {query.data?.map((schoolClass) => (
                        <option
                            key={schoolClass.id}
                            value={schoolClass.id}
                        >
                            {schoolClass.name}
                        </option>
                    ))}
                </select>
            </label>

            {query.error && (
                <div className="space-y-2">
                    <p role="alert" className="text-sm text-destructive">
                        {query.error}
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={query.retry}
                    >
                        Qayta urinish
                    </Button>
                </div>
            )}

            {!query.loading &&
                !query.error &&
                query.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Ushbu maktab va o‘quv yilida sinflar yo‘q.
                        Avval sinf yarating.
                    </p>
                )}
        </div>
    );
}