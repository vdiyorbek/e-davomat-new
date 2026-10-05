import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'forbidden' | 'missing';
type Cell = 'ok' | 'late' | 'flag' | 'empty';

const CELLS: Cell[] = ['ok', 'ok', 'late', 'ok', 'flag', 'empty'];

interface ErrorCardProps {
    variant: Variant;
    code: string;
    title: string;
    text: string;
    actions: ReactNode;
}

export function ErrorCard({ variant, code, title, text, actions }: ErrorCardProps) {
    const forbidden = variant === 'forbidden';
    const [first, , last] = [code[0], code[1], code[2]];

    return (
        <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
                <div className="mx-auto mb-8 flex w-fit gap-2" aria-hidden="true">
                    {CELLS.map((cell, i) => (
                        <span
                            key={i}
                            className={cn(
                                'grid size-9 place-items-center rounded-lg text-sm font-bold text-white',
                                cell === 'ok' && 'bg-success',
                                cell === 'late' && 'bg-warning',
                                cell === 'empty' && 'bg-muted',
                                cell === 'flag' && forbidden && 'bg-destructive ring-4 ring-destructive/20',
                                cell === 'flag' &&
                                    !forbidden &&
                                    'border-2 border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground',
                            )}
                        >
                            {cell === 'flag' && (forbidden ? <Lock className="size-4" /> : '?')}
                        </span>
                    ))}
                </div>

                <p className="text-6xl font-extrabold tracking-tight">
                    {first}
                    <span className={forbidden ? 'text-destructive' : 'text-warning'}>0</span>
                    {last}
                </p>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{text}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>
            </div>
        </div>
    );
}
