import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { authorizedGet } from "@/lib/auth-session";
import i18n from "@/i18n";

/** Oxirgi tugallangan so‘rov natijasi. */
interface Settled<T> {
  path: string;
  attempt: number;
  data: T | null;
  error: string;
}

/**
 * GET so‘rov holati.
 *
 *  • `loading`    — shu manzil uchun hali ma’lumot yo‘q (birinchi yuklanish yoki xatodan keyin).
 *  • `refreshing` — `retry()` chaqirildi: eski ma’lumot ko‘rinib turadi va yangisi
 *                   kelganda almashtiriladi. Shu sababli avto-yangilanishda jadval
 *                   skeletonga aylanib «sakramaydi».
 */
export function useApiQuery<T>(path: string) {
  const { session } = useAuth();
  const userId = session?.profile.id;

  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();

    void authorizedGet<T>(path, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSettled({ path, attempt, data, error: "" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        setSettled({
          path,
          attempt,
          data: null,
          error: error instanceof ApiError ? error.message : i18n.t("common.loadFailed"),
        });
      });

    return () => {
      controller.abort();
    };
  }, [path, userId, attempt]);

  function retry() {
    setAttempt((value) => value + 1);
  }

  const samePath = settled?.path === path;
  const done = samePath && settled.attempt === attempt;
  const data = samePath ? settled.data : null;

  return {
    data,
    error: done ? settled.error : "",
    loading: !samePath || (!done && data === null),
    refreshing: samePath && !done && data !== null,
    retry,
  };
}
