import { Router } from 'express';
import { SyncService } from './sync-service';

const router = Router();

let syncInProgress = false;

router.post('/webdav', async (_req, res) => {
  if (syncInProgress) {
    res.status(409).json({ error: 'Sync already in progress' });
    return;
  }
  syncInProgress = true;
  try {
    const result = await SyncService.syncWebdav();
    res.json(result);
  } catch (err: any) {
    console.error('WebDAV sync error:', err);
    res.status(502).json({ error: err?.message ?? 'WebDAV sync failed' });
  } finally {
    syncInProgress = false;
  }
});

// Verify WebDAV connectivity without persisting credentials
router.post('/verify-webdav', async (req, res) => {
  const { webdav_url, webdav_username, webdav_password, webdav_db_path } = req.body as {
    webdav_url?: string;
    webdav_username?: string;
    webdav_password?: string;
    webdav_db_path?: string;
  };

  if (!webdav_url || !webdav_db_path) {
    res.json({ ok: false, message: 'WebDAV URL and database path are required' });
    return;
  }

  const baseUrl = webdav_url.replace(/\/$/, '');
  const filePath = webdav_db_path.startsWith('/') ? webdav_db_path : `/${webdav_db_path}`;
  const url = `${baseUrl}${filePath}`;

  const headers: Record<string, string> = {};
  if (webdav_username && webdav_password) {
    const encoded = Buffer.from(`${webdav_username}:${webdav_password}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }

  try {
    const response = await fetch(url, { method: 'HEAD', headers });
    if (response.ok) {
      const filename = webdav_db_path.split('/').pop() ?? webdav_db_path;
      res.json({ ok: true, message: `Connection successful — found ${filename}` });
    } else {
      res.json({ ok: false, message: `Server returned ${response.status} ${response.statusText}` });
    }
  } catch (err: any) {
    res.json({ ok: false, message: err?.message ?? 'Connection failed' });
  }
});

export { router as syncRouter };
