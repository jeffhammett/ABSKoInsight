import { unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { Router } from 'express';
import { appConfig } from '../config';
import { SettingsRepository } from '../settings/settings-repository';
import { UploadService } from '../upload/upload-service';

const router = Router();

let syncInProgress = false;

router.post('/webdav', async (_req, res) => {
  if (syncInProgress) {
    res.status(409).json({ error: 'Sync already in progress' });
    return;
  }
  syncInProgress = true;
  const settings = await SettingsRepository.get();

  if (!settings.webdav_url || !settings.webdav_db_path) {
    res.status(400).json({ error: 'WebDAV URL and database file path must be configured in Settings' });
    return;
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

  let tempPath: string | null = null;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      res
        .status(502)
        .json({ error: `WebDAV request failed: ${response.status} ${response.statusText}` });
      return;
    }

    const buffer = await response.arrayBuffer();
    tempPath = path.resolve(appConfig.dataPath, `webdav_sync_${Date.now()}.sqlite3`);
    writeFileSync(tempPath, Buffer.from(buffer));

    let koDb;
    try {
      koDb = UploadService.openStatisticsDbFile(tempPath);
      const { newBooks, newPageStats } = UploadService.extractDataFromStatisticsDb(koDb);
      await UploadService.uploadStatisticData(newBooks, newPageStats);
      res.json({ message: 'WebDAV sync completed successfully', booksCount: newBooks.length });
    } finally {
      koDb?.close();
    }
  } catch (err: any) {
    console.error('WebDAV sync error:', err);
    res.status(500).json({ error: err?.message ?? 'WebDAV sync failed' });
  } finally {
    syncInProgress = false;
    if (tempPath) {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  }
});

export { router as syncRouter };
