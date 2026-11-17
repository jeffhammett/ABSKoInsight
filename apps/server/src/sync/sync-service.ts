import { readdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { appConfig } from '../config';
import { SettingsRepository } from '../settings/settings-repository';
import { UploadService } from '../upload/upload-service';

const TEMP_PREFIX = 'webdav_sync_';
// SQLite companion files. KOReader's statistics DB uses WAL mode, so opening it (even read-only)
// creates -wal and -shm files next to it that SQLite does not remove on close.
const SQLITE_SUFFIXES = ['', '-wal', '-shm', '-journal'];

export function removeSqliteFiles(dbPath: string) {
  for (const suffix of SQLITE_SUFFIXES) {
    try {
      unlinkSync(`${dbPath}${suffix}`);
    } catch {}
  }
}

// Removes temp files left behind by earlier syncs (e.g. a crash mid-sync, or older versions
// that only deleted the main file). Files newer than maxAgeMs are kept, in case another sync
// is still using them.
export function removeStaleSyncFiles(dir: string, now = Date.now(), maxAgeMs = 10 * 60 * 1000) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const match = /^webdav_sync_(\d+)\.sqlite3(-wal|-shm|-journal)?$/.exec(name);
    if (!match || now - Number(match[1]) < maxAgeMs) continue;
    try {
      unlinkSync(path.join(dir, name));
    } catch {}
  }
}

export class SyncService {
  static async syncWebdav(): Promise<{ message: string; booksCount: number }> {
    const settings = await SettingsRepository.get();

    if (!settings.webdav_url || !settings.webdav_db_path) {
      throw new Error('WebDAV URL and database file path must be configured in Settings');
    }

    const baseUrl = settings.webdav_url.replace(/\/$/, '');
    const filePath = settings.webdav_db_path.startsWith('/')
      ? settings.webdav_db_path
      : `/${settings.webdav_db_path}`;
    const url = `${baseUrl}${filePath}`;

    const headers: Record<string, string> = {};
    if (settings.webdav_username && settings.webdav_password) {
      const encoded = Buffer.from(
        `${settings.webdav_username}:${settings.webdav_password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`WebDAV request failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    removeStaleSyncFiles(path.resolve(appConfig.dataPath));
    const tempPath = path.resolve(appConfig.dataPath, `${TEMP_PREFIX}${Date.now()}.sqlite3`);
    writeFileSync(tempPath, Buffer.from(buffer));

    let koDb;
    try {
      koDb = UploadService.openStatisticsDbFile(tempPath);
      const { newBooks, newPageStats } = UploadService.extractDataFromStatisticsDb(koDb);
      await UploadService.uploadStatisticData(newBooks, newPageStats);
      await SettingsRepository.update({ webdav_last_synced_at: new Date().toISOString() });
      return { message: 'WebDAV sync completed successfully', booksCount: newBooks.length };
    } finally {
      koDb?.close();
      removeSqliteFiles(tempPath);
    }
  }
}
