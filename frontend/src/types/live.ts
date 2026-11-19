export interface LiveEvent {
  eventId: string;
  terminalId: number;
  direction: "IN" | "OUT";
  eventAt: string;
  pnfl: string;
  hasPhoto: boolean;
  person: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
  } | null;
  membershipType: "STUDENT" | "TEACHER" | null;
  className: string | null;
}

export interface LiveSummary {
  date: string;
  passes: number;
  students: number;
  teachers: number;
  lastEventAt: string | null;
  serverTime: string;
}

export interface LiveTerminal {
  id: number;
  name: string;
  direction: "IN" | "OUT";
  pushEnabled: boolean;
  pushLastReceivedAt: string | null;
  healthStatus: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED" | "ARCHIVED";
}
