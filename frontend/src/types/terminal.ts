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
  archivedAt: string | null;
  model: string | null;
  serialNumber: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncStartAt: string | null;
  eventsSyncedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  healthStatus: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED" | "ARCHIVED";

  lastSeenAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;

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

export interface TerminalMonitoringItem {
  id: number;
  name: string;
  totalEvents: number;
  repeatedEvents: number;
  repeatedPercent: number;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  eventsSyncedUntil: string | null;
  syncDelaySeconds: number | null;
  syncStatus: "DISABLED" | "NOT_STARTED" | "HEALTHY" | "DELAYED";
}

export interface TerminalMonitoringResponse {
  data: TerminalMonitoringItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  date: string;
  checkedAt: string;
}

/** GET /terminals/summary — filtr bo‘yicha BARCHA terminallar holati. */
export interface TerminalsSummary {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  disabled: number;
  archived: number;
  syncDelayed: number;
  checkedAt: string;
}

/** Ko‘rsatkich kartasi bosilganda qo‘llanadigan holat filtri. */
export type TerminalStatusFilter = "" | "ONLINE" | "OFFLINE" | "DELAYED";
