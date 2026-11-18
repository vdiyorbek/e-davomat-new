export const HIKVISION_PUSH_QUEUE = 'hikvision-push-v1';
export const HIKVISION_PUSH_JOB = 'access-event';

export interface PushJob {
  terminalId: number;
  sourceIp: string;
  contentType: string;
  bodyBase64: string;
  receivedAt: string;
}

export interface TerminalBinding {
  terminalId: number;
  token: string;
  ips: string[];
}
