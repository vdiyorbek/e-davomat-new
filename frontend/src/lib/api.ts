import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { LoginResponse, Profile } from "@/types/auth";
import i18n from "@/i18n";

const http = axios.create({
  baseURL: (
    import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
  ).replace(/\/+$/, ""),
  timeout: 15000,
  withCredentials: true,
});

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<T>({
      ...config,
      headers: {
        "Accept-Language": i18n.resolvedLanguage ?? "uz",
        ...config.headers,
      },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (!axios.isAxiosError<unknown>(error)) throw error;

    if (!error.response) {
      throw new ApiError(i18n.t("common.network.unreachable"), 0);
    }

    const status = error.response.status;
    const body = error.response.data;
    let message = i18n.t("common.network.failedStatus", { status });

    if (typeof body === "object" && body !== null && "message" in body) {
      if (typeof body.message === "string") {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        const messages = body.message.filter(
          (item): item is string => typeof item === "string",
        );
        if (messages.length) message = messages.join(". ");
      }
    }

    if (status === 429) {
      message = i18n.t("common.network.tooMany");
    }

    throw new ApiError(message, status);
  }
}

export function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>({
    method: "POST",
    url: "/auth/login",
    data: {
      login: username.trim().toLowerCase(),
      password,
    },
  });
}

export function getProfile(token: string): Promise<Profile> {
  return apiGet<Profile>("/me", token);
}

export function refreshAuth(): Promise<LoginResponse> {
  return request<LoginResponse>({
    method: "POST",
    url: "/auth/refresh",
  });
}

export function logoutAuth(): Promise<void> {
  return request<void>({
    method: "POST",
    url: "/auth/logout",
  });
}

export function apiPost<T>(
  path: string,
  token: string,
  body: unknown,
  timeoutMs?: number,
): Promise<T> {
  return request<T>({
    method: "POST",
    url: path,
    data: body,
    timeout: timeoutMs,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function apiPatch<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  return request<T>({
    method: "PATCH",
    url: path,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function apiGet<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
  responseType: "json" | "blob" = "json",
  timeoutMs?: number,
): Promise<T> {
  return request<T>({
    method: "GET",
    url: path,
    signal,
    responseType,
    timeout: timeoutMs,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function apiDelete<T>(path: string, token: string): Promise<T> {
  return request<T>({
    method: "DELETE",
    url: path,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function apiPut<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  return request<T>({
    method: "PUT",
    url: path,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
