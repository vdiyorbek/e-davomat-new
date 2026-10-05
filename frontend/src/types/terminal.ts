export type TerminalDirection = "IN" | "OUT";
export type TerminalProtocol = "HTTP" | "HTTPS";

export interface Terminal {
  id: number;
  name: string;
  schoolId: number;
  direction: TerminalDirection;
  protocol: TerminalProtocol;
  host: string;
  port: number;
  username: string;
  isActive: boolean;
  model: string | null;
  serialNumber: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncStartAt: string | null;
  eventsSyncedUntil: string | null;
  createdAt: string;
  updatedAt: string;

  school: {
    id: number;
    name: string;
    district: {
      id: number;
      name: string;
    };
    region: {
      id: number;
      name: string;
    };
  };
}

export interface TerminalsPageResponse {
  data: Terminal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTerminalInput {
  name: string;
  schoolId: number;
  direction: TerminalDirection;
  protocol: TerminalProtocol;
  host: string;
  port: number;
  username: string;
  password: string;
  isActive: boolean;
}

export type TerminalCheckResponse =
  | {
      success: true;
      terminalId: number;
      checkedAt: string;
      message: string;
      model: string;
      serialNumber: string;
      firmwareVersion: string | null;
    }
  | {
      success: false;
      terminalId: number;
      checkedAt: string;
      message: string;
    };

    