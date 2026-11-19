import {
  authorizedPost,
  authorizedPatch,
  authorizedDelete,
} from "@/lib/auth-session";

import type {
  CreateTerminalInput,
  Terminal,
  TerminalCheckResponse,
} from "@/types/terminal";

export function createTerminal(input: CreateTerminalInput): Promise<Terminal> {
  return authorizedPost<Terminal>("/terminals", input);
}

export interface PushTokenResponse {
  terminalId: number;
  pushEnabled: boolean;
  token: string;
  path: string;
  url: string | null;
}

/** Yangi push token (eskisi bekor bo‘ladi). Token faqat shu javobda ko‘rinadi. */
export function generatePushToken(terminalId: number): Promise<PushTokenResponse> {
  return authorizedPost<PushTokenResponse>(`/terminals/${terminalId}/push/token`, {});
}

export function disablePushToken(terminalId: number): Promise<{ pushEnabled: boolean }> {
  return authorizedPost<{ pushEnabled: boolean }>(`/terminals/${terminalId}/push/disable`, {});
}

export function checkTerminal(
  terminalId: number,
): Promise<TerminalCheckResponse> {
  return authorizedPost<TerminalCheckResponse>(
    `/terminals/${terminalId}/check`,
    {},
  );
}
export function updateTerminal(
  terminalId: number,
  input: Partial<CreateTerminalInput>,
): Promise<Terminal> {
  return authorizedPatch<Terminal>(`/terminals/${terminalId}`, input);
}

interface TerminalArchiveResponse {
  success: boolean;
  message: string;
  terminalId: number;
  archivedAt: string | null;
}

export function archiveTerminal(
  terminalId: number,
): Promise<TerminalArchiveResponse> {
  return authorizedDelete<TerminalArchiveResponse>(`/terminals/${terminalId}`);
}

export function restoreTerminal(
  terminalId: number,
): Promise<TerminalArchiveResponse> {
  return authorizedPost<TerminalArchiveResponse>(
    `/terminals/${terminalId}/restore`,
    {},
  );
}
