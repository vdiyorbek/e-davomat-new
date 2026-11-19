import type { ReactNode } from 'react';

/** Grafik ustidagi bitta tooltip; konteyner chegarasidan chiqmaydi. */
export function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
    const left = Math.min(Math.max(x + 12, 0), Math.max(0, width - 220));
    return (
        <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
            style={{ left, top: Math.max(0, y - 10) }}
        >
            {children}
        </div>
    );
}

/** Tooltip qatori: qiymat oldinda (qalin), nom keyin; seriya — qisqa chiziq bilan. */
export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 tabular-nums">
            {color && <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: color }} />}
            <span className="font-semibold">{value}</span>
            <span className="text-muted-foreground">{label}</span>
        </div>
    );
}
