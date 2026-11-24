import { useEffect, useState } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useApiQuery } from '@/hooks/useApiQuery';
import { useInterval } from '@/hooks/useInterval';

interface Weather {
    temperature: number;
    feelsLike: number | null;
    code: number;
    isDay: boolean;
    windMs: number | null;
    humidity: number | null;
}

type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'showers' | 'thunder';

/** WMO ob-havo kodi → turi. */
function conditionOf(code: number): Condition {
    if (code === 0) return 'clear';
    if (code <= 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return code >= 80 ? 'showers' : 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloudy';
}

const ICONS: Record<Condition, LucideIcon> = {
    clear: Sun,
    partly: CloudSun,
    cloudy: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    rain: CloudRain,
    snow: CloudSnow,
    showers: CloudRain,
    thunder: CloudLightning,
};

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

function useTashkentClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);
    const [hours = '--', minutes = '--', seconds = '--'] = TIME.format(now).split(':');
    return { hours, minutes, seconds };
}

/** Bosh sahifa sarlavhasining o‘ng tomonida: Toshkent vaqti va tanlangan hudud ob-havosi. */
export function ClockWeather({ scope }: { scope: string }) {
    const { t } = useTranslation();
    const { hours, minutes, seconds } = useTashkentClock();
    const weather = useApiQuery<Weather>(`/weather${scope ? `?${scope}` : ''}`);
    // Ob-havo 30 daqiqada yangilanadi (server ham shuncha keshlaydi).
    useInterval(weather.retry, 30 * 60_000);

    const data = weather.data;
    const condition = data ? conditionOf(data.code) : null;
    const Icon = data && condition ? (condition === 'clear' && !data.isDay ? Moon : ICONS[condition]) : null;
    const details = data
        ? [
              data.feelsLike !== null ? t('weather.feelsLike', { value: data.feelsLike }) : null,
              data.humidity !== null ? t('weather.humidity', { value: Math.round(data.humidity) }) : null,
              data.windMs !== null ? t('weather.wind', { value: data.windMs }) : null,
          ].filter(Boolean)
        : [];

    return (
        <div className="flex items-stretch divide-x overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col justify-center px-4 py-2.5" role="timer" aria-label={t('weather.time')}>
                <p className="font-heading text-2xl leading-none font-bold tabular-nums">
                    {hours}:{minutes}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">{seconds}</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t('weather.timezone')}</p>
            </div>
            {data && Icon && condition && (
                <div className="flex items-center gap-3 px-4 py-2.5" title={details.join(' · ')}>
                    <Icon aria-hidden="true" className="size-9 shrink-0 text-primary" strokeWidth={1.6} />
                    <div className="min-w-0">
                        <p className="font-heading text-2xl leading-none font-bold tabular-nums">{data.temperature > 0 ? '+' : ''}{data.temperature}°</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t(`weather.conditions.${condition}`)}</p>
                    </div>
                    <p className="hidden max-w-36 text-[11px] leading-4 text-muted-foreground xl:block">{details.join(' · ')}</p>
                </div>
            )}
        </div>
    );
}
