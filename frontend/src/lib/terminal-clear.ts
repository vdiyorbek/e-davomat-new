export interface ClearResult {
  usersBefore: number;
  usersAfter: number;
  facesAfter: number | null;
  cleared: boolean;
}

export interface ClearJobResponse {
  state: string;
  error: string | null;
  result: ClearResult | null;
}

const ERROR_KEYS: Record<string, string> = {
  TERMINAL_BUSY: "terminals.clearPersons.errors.busy",
  CLEAR_NOT_SUPPORTED: "terminals.clearPersons.errors.notSupported",
  CLEAR_TIMEOUT: "terminals.clearPersons.errors.timeout",
  DEVICE_AUTH_FAILED: "terminals.clearPersons.errors.auth",
};

/** Backend xato matnidagi kodga mos tarjima kalitini qaytaradi. */
export function clearErrorKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = Object.keys(ERROR_KEYS).find((key) => raw.includes(key));
  return code ? ERROR_KEYS[code] : null;
}

export function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
