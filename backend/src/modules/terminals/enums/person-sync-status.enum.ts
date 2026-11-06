export enum PersonSyncStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  USER_CREATED = 'USER_CREATED',
  FACE_UPLOADED = 'FACE_UPLOADED',
  VERIFIED = 'VERIFIED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export interface PersonSyncResult {
  terminalId: number;
  personId: number;
  status: PersonSyncStatus;
  userCreated: boolean;
  faceUploaded: boolean;
  verified: boolean;
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
}
