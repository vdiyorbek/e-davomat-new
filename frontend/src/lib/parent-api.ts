import { API_BASE_URL } from '@/lib/api';

interface TelegramWebApp {
    initData: string;
    colorScheme?: 'light' | 'dark';
    ready: () => void;
    expand?: () => void;
    setHeaderColor?: (color: string) => void;
}

declare global {
    interface Window {
        Telegram?: { WebApp?: TelegramWebApp };
    }
}

export class ParentApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export function telegramApp(): TelegramWebApp | null {
    return window.Telegram?.WebApp ?? null;
}

/** Telegram skriptini (faqat shu sahifada) yuklaydi va tayyor bo‘lguncha kutadi. */
export function loadTelegram(): Promise<TelegramWebApp | null> {
    if (telegramApp()) return Promise.resolve(telegramApp());
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        script.onload = () => resolve(telegramApp());
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
        window.setTimeout(() => resolve(telegramApp()), 5000);
    });
}

/** Rasm kabi ikkilik javoblar uchun (sarlavha kerak, shuning uchun <img src> ishlamaydi). */
export async function parentBlob(path: string, signal?: AbortSignal): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/parent${path}`, {
        headers: { 'X-Telegram-Init-Data': telegramApp()?.initData ?? '' },
        signal,
    });
    if (!response.ok) throw new ParentApiError(`HTTP ${response.status}`, response.status);
    return await response.blob();
}

export async function parentRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/parent${path}`, {
        method: init.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': telegramApp()?.initData ?? '',
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === 'string') message = data.message;
        } catch {
            /* matn yo‘q */
        }
        throw new ParentApiError(message, response.status);
    }
    return (await response.json()) as T;
}
