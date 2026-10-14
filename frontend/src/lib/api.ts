import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { LoginResponse, Profile } from "@/types/auth";

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
    const response = await http.request<T>(config);
    return response.data;
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (!axios.isAxiosError<unknown>(error)) throw error;

    if (!error.response) {
      throw new ApiError(
        "Server bilan bog‘lanib bo‘lmadi yoki javob vaqti tugadi.",
        0,
      );
    }

    const status = error.response.status;
    const body = error.response.data;
    let message = `So‘rov bajarilmadi (${status})`;

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
      message = "Urinishlar soni oshdi. Birozdan keyin qayta urining.";
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
): Promise<T> {
  return request<T>({
    method: "POST",
    url: path,
    data: body,
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
