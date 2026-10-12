import {
  ApiError,
  apiGet,
  apiPost,
  getProfile,
  login,
  logoutAuth,
  refreshAuth,
  apiPatch,
} from "@/lib/api";
import type { LoginResponse, Session, Profile } from "@/types/auth";

interface AuthState {
  session: Session | null;
  status: "loading" | "ready" | "error";
  notice: string;
  error: string;
}

let state: AuthState = {
  session: null,
  status: "loading",
  notice: "",
  error: "",
};

let generation = 0;

const listeners = new Set<() => void>();

export function getAuthSnapshot(): AuthState {
  return state;
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function updateState(next: AuthState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "So‘rovni bajarishda xatolik yuz berdi. Qayta urinib ko‘ring.";
}

// Bitta sahifadagi auth operatsiyalari navbat bilan bajariladi.
let authQueue: Promise<void> = Promise.resolve();

function withAuthLock<T>(task: () => Promise<T>): Promise<T> {
  const result = authQueue.then(() => {
    // Qo‘llab-quvvatlanadigan brauzerlarda boshqa tablar bilan
    // ham cookie yangilash operatsiyalarini navbatlaydi.
    if (navigator.locks) {
      return navigator.locks.request("davomat-auth-cookie", task);
    }

    return task();
  });

  authQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

async function makeSession(result: LoginResponse): Promise<Session> {
  const expiresAt = Date.now() + result.expiresIn * 1000;
  const profile = await getProfile(result.accessToken);

  return {
    token: result.accessToken,
    expiresAt,
    profile,
  };
}

function saveSession(session: Session): void {
  if (state.session?.profile.id !== session.profile.id) {
    generation += 1;
  }

  updateState({
    session,
    status: "ready",
    notice: "",
    error: "",
  });
}

function clearSession(notice: string): void {
  generation += 1;

  updateState({
    session: null,
    status: "ready",
    notice,
    error: "",
  });
}

// StrictMode yoki parallel chaqiruvlar bitta tiklash so‘rovini kutadi.
let restorePromise: Promise<void> | null = null;

export function restoreSession(): Promise<void> {
  if (restorePromise) return restorePromise;
  if (state.status === "ready") return Promise.resolve();

  updateState({
    ...state,
    status: "loading",
    error: "",
  });

  restorePromise = withAuthLock(async () => {
    try {
      const result = await refreshAuth();
      const session = await makeSession(result);

      saveSession(session);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession("");
        return;
      }

      updateState({
        ...state,
        status: "error",
        error: errorMessage(error),
      });
    }
  }).finally(() => {
    restorePromise = null;
  });

  return restorePromise;
}

export function signIn(username: string, password: string): Promise<void> {
  return withAuthLock(async () => {
    const result = await login(username, password);
    const session = await makeSession(result);

    generation += 1;
    saveSession(session);
  });
}

export function signOut(message = "Kabinetdan chiqdingiz."): Promise<void> {
  return withAuthLock(async () => {
    // Server tasdiqlamaguncha mahalliy sessiyani o‘chirmaymiz.
    await logoutAuth();
    clearSession(message);
  });
}

let refreshPromise: Promise<Session> | null = null;

function refreshCurrentSession(failedToken?: string): Promise<Session> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = withAuthLock(async () => {
    const current = state.session;

    if (!current) {
      throw new ApiError("Avval tizimga kiring.", 401);
    }

    // Boshqa so‘rov tokenni allaqachon yangilagan.
    if (failedToken && current.token !== failedToken) {
      return current;
    }

    // Oddiy tekshiruvda hali yaroqli tokenni qayta ishlatamiz.
    if (!failedToken && current.expiresAt > Date.now() + 30_000) {
      return current;
    }

    try {
      const result = await refreshAuth();
      const session = await makeSession(result);

      saveSession(session);

      return session;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession("Sessiya tugadi. Qayta tizimga kiring.");
      }

      // Tarmoq yoki server xatosida sessiya saqlanadi.
      throw error;
    }
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function refreshOnFocus(): Promise<void> {
  if (!state.session) return;

  await refreshCurrentSession();
}

export async function authorizedGet<T>(
  path: string,
  signal?: AbortSignal,
  responseType: "json" | "blob" = "json",
): Promise<T> {
  signal?.throwIfAborted();

  const requestGeneration = generation;

  let current = state.session;

  if (!current) {
    throw new ApiError("Avval tizimga kiring.", 401);
  }

  if (current.expiresAt <= Date.now() + 30_000) {
    current = await refreshCurrentSession();
  }

  function checkRequest(): void {
    signal?.throwIfAborted();

    // Chiqish yoki akkaunt almashishdan oldingi javobni tashlaymiz.
    if (requestGeneration !== generation || !state.session) {
      throw new DOMException("Sessiya o‘zgardi.", "AbortError");
    }
  }

  checkRequest();

  let data: T;

  try {
    data = await apiGet<T>(path, current.token, signal, responseType);
  } catch (error: unknown) {
    checkRequest();

    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    // 401 bo‘lsa tokenni yangilab faqat bir marta takrorlaymiz.
    current = await refreshCurrentSession(current.token);

    checkRequest();

    try {
      data = await apiGet<T>(path, current.token, signal, responseType);
    } catch (retryError: unknown) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        state.session?.token === current.token
      ) {
        clearSession("Sessiya tugadi. Qayta tizimga kiring.");
      }

      throw retryError;
    }
  }

  checkRequest();

  return data;
}

export async function authorizedPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const requestGeneration = generation;

  let current = state.session;

  if (!current) {
    throw new ApiError("Avval tizimga kiring.", 401);
  }

  if (current.expiresAt <= Date.now() + 30_000) {
    current = await refreshCurrentSession();
  }

  function checkSession(): void {
    if (requestGeneration !== generation || !state.session) {
      throw new DOMException("Sessiya o‘zgardi.", "AbortError");
    }
  }

  checkSession();

  let result: T;

  try {
    result = await apiPost<T>(path, current.token, body);
  } catch (error: unknown) {
    checkSession();

    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    current = await refreshCurrentSession(current.token);

    checkSession();

    try {
      result = await apiPost<T>(path, current.token, body);
    } catch (retryError: unknown) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        state.session?.token === current.token &&
        requestGeneration === generation
      ) {
        clearSession("Sessiya tugadi. Qayta tizimga kiring.");
      }

      throw retryError;
    }
  }

  checkSession();

  return result;
}

export async function authorizedPatch<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const requestGeneration = generation;

  let current = state.session;

  if (!current) {
    throw new ApiError("Avval tizimga kiring.", 401);
  }

  if (current.expiresAt <= Date.now() + 30_000) {
    current = await refreshCurrentSession();
  }

  function checkSession(): void {
    if (requestGeneration !== generation || !state.session) {
      throw new DOMException("Sessiya o‘zgardi.", "AbortError");
    }
  }

  checkSession();

  let result: T;

  try {
    result = await apiPatch<T>(path, current.token, body);
  } catch (error: unknown) {
    checkSession();

    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    // Token rad etilsa, yangilab bir marta takrorlaymiz.
    current = await refreshCurrentSession(current.token);

    checkSession();

    try {
      result = await apiPatch<T>(path, current.token, body);
    } catch (retryError: unknown) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        state.session?.token === current.token &&
        requestGeneration === generation
      ) {
        clearSession("Sessiya tugadi. Qayta tizimga kiring.");
      }

      throw retryError;
    }
  }

  checkSession();

  return result;
}

export async function reloadCurrentProfile(): Promise<void> {
  const current = state.session;

  if (!current) {
    throw new ApiError("Avval tizimga kiring.", 401);
  }

  const currentGeneration = generation;
  const profile = await authorizedGet<Profile>("/me");

  // Foydalanuvchi shu vaqt ichida akkauntdan
  // chiqib ketgan bo‘lsa, eski ma’lumotni yozmaymiz.
  if (
    currentGeneration !== generation ||
    !state.session ||
    state.session.profile.id !== profile.id
  ) {
    return;
  }

  updateState({
    ...state,
    session: {
      ...state.session,
      profile,
    },
  });
}
