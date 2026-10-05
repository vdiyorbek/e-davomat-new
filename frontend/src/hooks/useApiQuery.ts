import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { authorizedGet } from "@/lib/auth-session";

interface QueryState<T> {
  data: T | null;
  error: string;
  loading: boolean;
}

export function useApiQuery<T>(path: string) {
  const { session } = useAuth();
  const userId = session?.profile.id;

  const [attempt, setAttempt] = useState(0);

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    error: "",
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();

    setState({
      data: null,
      error: "",
      loading: true,
    });

    void authorizedGet<T>(path, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;

        setState({
          data,
          error: "",
          loading: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          data: null,
          error:
            error instanceof ApiError
              ? error.message
              : "Ma’lumotlarni yuklashda xatolik yuz berdi.",
          loading: false,
        });
      });

    return () => {
      controller.abort();
    };
  }, [path, userId, attempt]);

  function retry() {
    setAttempt((value) => value + 1);
  }

  return {
    ...state,
    retry,
  };
}
