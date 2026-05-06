import { Request, Response, Router } from 'express';
import { existsSync, mkdirSync, promises as fsPromises, rmSync } from 'fs';
import multer from 'multer';
import path from 'path';
import { appConfig } from '../config';
import { SettingsRepository } from '../settings/settings-repository';
import { AbsOverridesRepository } from './abs-overrides-repository';

const router = Router();

async function absRequest<T>(absUrl: string, apiKey: string, reqPath: string): Promise<T> {
  const base = absUrl.replace(/\/$/, '');
  const response = await fetch(`${base}${reqPath}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`ABS API error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function getConfig() {
  const settings = await SettingsRepository.get();
  if (!settings.abs_url || !settings.abs_api_key) return null;
  return { absUrl: settings.abs_url, apiKey: settings.abs_api_key };
}

function absCoversPath() {
  return appConfig.coversPath;
}

async function getCustomCoverPath(itemId: string): Promise<string | null> {
  const dir = absCoversPath();
  if (!existsSync(dir)) return null;
  const files = await fsPromises.readdir(dir);
  const file = files.find((f) => f.startsWith(`abs-${itemId}`));
  return file ? path.join(dir, file) : null;
}

router.get('/books', async (req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }

  const showHidden = req.query.showHidden === 'true';

  try {
    const { libraries } = await absRequest<{ libraries: any[] }>(
      config.absUrl,
      config.apiKey,
      '/api/libraries'
    );

    const bookLibraries = (libraries ?? []).filter((lib: any) => lib.mediaType === 'book');
    const allItems: any[] = [];
    for (const lib of bookLibraries) {
      const data = await absRequest<{ results: any[] }>(
        config.absUrl,
        config.apiKey,
        `/api/libraries/${lib.id}/items?limit=1000`
      );
      allItems.push(...(data.results ?? []));
    }

    const me = await absRequest<{ mediaProgress?: any[] }>(config.absUrl, config.apiKey, '/api/me');
    const progressMap: Record<string, any> = {};
    for (const p of me.mediaProgress ?? []) {
      progressMap[p.libraryItemId] = p;
    }

    const overrides = await AbsOverridesRepository.getAll();
    const overrideMap: Record<string, { hidden: boolean; deleted: boolean }> = {};
    for (const o of overrides) {
      overrideMap[o.abs_item_id] = { hidden: o.hidden, deleted: o.deleted };
    }

    // Sum actual listening time per book from session records
    const sessionsData = await absRequest<{ sessions?: any[] }>(
      config.absUrl,
      config.apiKey,
      '/api/me/listening-sessions?page=0&itemsPerPage=1000'
    );
    const listeningTimeMap: Record<string, number> = {};
    for (const session of sessionsData.sessions ?? []) {
      const itemId = session.libraryItemId as string;
      listeningTimeMap[itemId] = (listeningTimeMap[itemId] ?? 0) + (session.timeListening ?? 0);
    }

    const books = allItems
      .map((item: any) => {
        const meta = item.media?.metadata ?? {};
        const progress = progressMap[item.id] ?? {};
        const override = overrideMap[item.id] ?? { hidden: false, deleted: false };
        return {
          id: item.id,
          title: meta.title ?? 'Unknown',
          authors: meta.authorName ?? '',
          series: meta.seriesName ?? null,
          duration: item.media?.duration ?? 0,
          addedAt: item.addedAt ?? 0,
          progress: progress.progress ?? 0,
          currentTime: progress.currentTime ?? 0,
          listeningTime: listeningTimeMap[item.id] ?? 0,
          isFinished: progress.isFinished ?? false,
          finishedAt: progress.finishedAt ?? null,
          lastUpdate: progress.lastUpdate ?? null,
          source: 'audiobookshelf',
          hidden: override.hidden,
          deleted: override.deleted,
        };
      })
      .filter((b) => !b.deleted && (showHidden || !b.hidden));

    res.json(books);
  } catch (err: any) {
    console.error('ABS books error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf books' });
  }
});

router.patch('/books/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { hidden, deleted } = req.body as { hidden?: boolean; deleted?: boolean };

  try {
    const update: Record<string, boolean> = {};
    if (hidden !== undefined) update.hidden = hidden;
    if (deleted !== undefined) update.deleted = deleted;

    await AbsOverridesRepository.upsert(id, update);
    res.json({ message: 'Updated' });
  } catch (err: any) {
    console.error('ABS book patch error:', err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

const coverUpload = multer({
  dest: appConfig.coversPath,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
    if (allowed.some((ext) => file.originalname.toLowerCase().endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${allowed.join(', ')} files are allowed`));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/books/:id/cover', coverUpload.single('file'), async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'Missing file upload' });
    return;
  }

  try {
    const dir = absCoversPath();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Delete any existing custom cover for this item
    const existing = await getCustomCoverPath(id);
    if (existing) rmSync(existing, { force: true });

    // Rename uploaded temp file to abs-{itemId}.{ext}
    const ext = path.extname(file.originalname) || '';
    const newPath = path.join(dir, `abs-${id}${ext}`);
    await fsPromises.rename(file.path, newPath);

    res.json({ message: 'Cover updated' });
  } catch (err: any) {
    console.error('ABS cover upload error:', err);
    res.status(500).json({ error: 'Failed to upload cover' });
  }
});

router.get('/stats', async (_req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }

  try {
    const stats = await absRequest<any>(config.absUrl, config.apiKey, '/api/me/listening-stats');
    res.json({
      totalTime: stats.totalTime ?? 0,
      days: stats.days ?? {},
      dayOfWeek: stats.dayOfWeek ?? {},
      booksCount: Object.keys(stats.items ?? {}).length,
      recentSessions: (stats.recentSessions ?? []).slice(0, 10),
    });
  } catch (err: any) {
    console.error('ABS stats error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf stats' });
  }
});

router.get('/sessions', async (req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }

  const page = Number(req.query.page ?? 0);
  const itemsPerPage = Number(req.query.itemsPerPage ?? 500);

  try {
    const data = await absRequest<any>(
      config.absUrl,
      config.apiKey,
      `/api/me/listening-sessions?page=${page}&itemsPerPage=${itemsPerPage}`
    );
    res.json(data.sessions ?? []);
  } catch (err: any) {
    console.error('ABS sessions error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf sessions' });
  }
});

router.get('/cover/:itemId', async (req: Request<{ itemId: string }>, res: Response) => {
  const { itemId } = req.params;

  // Serve custom cover if one has been uploaded
  const customPath = await getCustomCoverPath(itemId);
  if (customPath) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(customPath);
    return;
  }

  const config = await getConfig();
  if (!config) {
    res.status(400).end();
    return;
  }

  try {
    const base = config.absUrl.replace(/\/$/, '');
    const response = await fetch(`${base}/api/items/${itemId}/cover`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!response.ok) {
      res.status(response.status).end();
      return;
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('ABS cover proxy error:', err);
    res.status(502).end();
  }
});

export { router as absRouter };
