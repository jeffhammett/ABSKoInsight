import { absRefresh } from './audiobookshelf/abs-router';
import { SettingsRepository } from './settings/settings-repository';
import { SyncService } from './sync/sync-service';

let webdavTimer: NodeJS.Timeout | null = null;
let absTimer: NodeJS.Timeout | null = null;

export async function reschedule(): Promise<void> {
  if (webdavTimer) { clearInterval(webdavTimer); webdavTimer = null; }
  if (absTimer) { clearInterval(absTimer); absTimer = null; }

  const settings = await SettingsRepository.get();

  if (settings.webdav_sync_interval_hours > 0) {
    const ms = settings.webdav_sync_interval_hours * 60 * 60 * 1000;
    webdavTimer = setInterval(async () => {
      try {
        await SyncService.syncWebdav();
        console.info('Scheduled WebDAV sync completed');
      } catch (e) {
        console.error('Scheduled WebDAV sync failed:', e);
      }
    }, ms);
  }

  if (settings.abs_sync_interval_minutes > 0) {
    const ms = settings.abs_sync_interval_minutes * 60 * 1000;
    absTimer = setInterval(async () => {
      try {
        await absRefresh();
        console.info('Scheduled ABS refresh completed');
      } catch (e) {
        console.error('Scheduled ABS refresh failed:', e);
      }
    }, ms);
  }
}

export async function startScheduler(): Promise<void> {
  await reschedule();
}
