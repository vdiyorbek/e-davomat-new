import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Push bilan kelgan yuz rasmini mavjud tuzilmaga yozadi:
 * uploads/attendance/<terminalId>/<yyyy>/<mm>/<dd>/push-<serial>-<uuid>.jpg
 * Natija — nisbiy yo‘l (attendance_events.photoPath).
 */
export class PhotoStore {
  private readonly knownDirs = new Set<string>();

  constructor(private readonly root: string) {}

  async save(
    terminalId: number,
    serialNo: string,
    eventAtIso: string,
    image: Buffer,
  ): Promise<string> {
    const [year, month, day] = eventAtIso.slice(0, 10).split('-');
    const relativeDirectory = [
      'uploads',
      'attendance',
      String(terminalId),
      year,
      month,
      day,
    ].join('/');

    if (!this.knownDirs.has(relativeDirectory)) {
      await mkdir(join(this.root, relativeDirectory), { recursive: true });
      if (this.knownDirs.size > 50_000) this.knownDirs.clear();
      this.knownDirs.add(relativeDirectory);
    }

    const fileName = `push-${serialNo}-${randomUUID().slice(0, 8)}.jpg`;
    const relativePath = `${relativeDirectory}/${fileName}`;

    await writeFile(join(this.root, relativePath), image, { flag: 'wx' });
    return relativePath;
  }

  async remove(relativePath: string): Promise<void> {
    await unlink(join(this.root, relativePath)).catch(() => undefined);
  }
}
