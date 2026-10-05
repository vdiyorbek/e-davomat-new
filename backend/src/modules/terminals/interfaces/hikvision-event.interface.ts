export interface HikvisionEvent {
  major: number;
  minor: number;
  time: string;

  serialNo: number | string;

  employeeNoString?: string;
  currentVerifyMode?: string;
  pictureURL?: string;

  name?: string;
  doorNo?: number;
}

export interface HikvisionEventsPage {
  events: HikvisionEvent[];
  hasMore: boolean;
  totalMatches: number;
}
