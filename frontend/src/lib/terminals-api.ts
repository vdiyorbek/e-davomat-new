import { authorizedPost } from "@/lib/auth-session";

import type {
  CreateTerminalInput,
  Terminal,
  TerminalCheckResponse,
} from "@/types/terminal";

export function createTerminal(input: CreateTerminalInput): Promise<Terminal> {
  return authorizedPost<Terminal>("/terminals", input);
}

export function checkTerminal(
  terminalId: number,
): Promise<TerminalCheckResponse> {
  return authorizedPost<TerminalCheckResponse>(
    `/terminals/${terminalId}/check`,
    {},
  );
}
