import {
  parseRetentionDays,
  retentionCutoff,
  safeAttendancePhotoPath,
} from './photo-retention.rules';
import { join, resolve } from 'node:path';

describe('photo-retention.rules', () => {
  it('parseRetentionDays', () => {
    expect(parseRetentionDays(undefined)).toBe(90);
    expect(parseRetentionDays('')).toBe(90);
    expect(parseRetentionDays('abc')).toBe(90);
    expect(parseRetentionDays('-5')).toBe(90);
    expect(parseRetentionDays('0')).toBeNull();
    expect(parseRetentionDays('3')).toBe(7);
    expect(parseRetentionDays('120')).toBe(120);
  });

  it('retentionCutoff', () => {
    const now = new Date('2026-11-08T00:00:00.000Z');
    expect(retentionCutoff(now, 90).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
  });

  it('safeAttendancePhotoPath', () => {
    const cwd = '/srv/app';
    expect(
      safeAttendancePhotoPath('uploads/attendance/1/2026/10/01/5-x.jpg', cwd),
    ).toBe(
      resolve(
        cwd,
        join('uploads', 'attendance', '1', '2026', '10', '01', '5-x.jpg'),
      ),
    );
    expect(safeAttendancePhotoPath('uploads/users/1-x.jpg', cwd)).toBeNull();
    expect(
      safeAttendancePhotoPath('uploads/attendance/../users/a.jpg', cwd),
    ).toBeNull();
    expect(safeAttendancePhotoPath('/etc/passwd', cwd)).toBeNull();
    expect(safeAttendancePhotoPath('uploads/attendance', cwd)).toBeNull();
  });
});
