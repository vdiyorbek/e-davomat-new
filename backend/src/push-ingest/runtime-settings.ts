import type { Pool, RowDataPacket } from 'mysql2/promise';

import {
  findSetting,
  parseSettingValue,
} from '../modules/system-settings/settings.registry';

/** Push qabul qiluvchi jarayonda «jonli» o‘zgaradigan sozlamalar. */
export interface PushRuntime {
  savePictures: boolean;
  perTerminalRps: number;
  maxBacklog: number;
}

const KEYS = {
  savePictures: 'pushSavePictures',
  perTerminalRps: 'pushMaxRpsPerTerminal',
  maxBacklog: 'pushMaxBacklog',
} as const;

function standard<K extends keyof PushRuntime>(name: K): PushRuntime[K] {
  return findSetting(KEYS[name])!.getDefault() as PushRuntime[K];
}

export function defaultRuntime(): PushRuntime {
  return {
    savePictures: standard('savePictures'),
    perTerminalRps: standard('perTerminalRps'),
    maxBacklog: standard('maxBacklog'),
  };
}

/** Bazadagi qiymatlar (agar bo‘lsa) standartdan ustun turadi. */
export async function refreshRuntime(
  pool: Pool,
  runtime: PushRuntime,
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `key`, `value` FROM system_settings WHERE `key` IN (?)',
    [Object.values(KEYS)],
  );
  const stored = new Map(rows.map((row) => [String(row.key), row.value]));

  const pick = (key: string) => {
    const definition = findSetting(key)!;
    const override = stored.has(key)
      ? parseSettingValue(definition, stored.get(key))
      : null;
    return override ?? definition.getDefault();
  };

  runtime.savePictures = pick(KEYS.savePictures) === true;
  runtime.perTerminalRps = Number(pick(KEYS.perTerminalRps));
  runtime.maxBacklog = Number(pick(KEYS.maxBacklog));
}
