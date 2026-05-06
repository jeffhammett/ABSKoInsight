import { unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { appConfig } from '../config';
import { SettingsRepository } from '../settings/settings-repository';
import { UploadService } from '../upload/upload-service';

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
    const tempPath = path.resolve(appConfig.dataPath, `webdav_sync_${Date.now()}.sqlite3`);
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
      try { unlinkSync(tempPath); } catch {}
    }
  }
}
