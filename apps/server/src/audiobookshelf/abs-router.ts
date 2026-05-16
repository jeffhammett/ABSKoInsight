import { Request, Response, Router } from 'express';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { rename } from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { appConfig } from '../config';
import { SettingsRepository } from '../settings/settings-repository';
import { AbsOverridesRepository } from './abs-overrides-repository';

const router = Router();

// ---------------------------------------------------------------------------
// Simple TTL cache
// ---------------------------------------------------------------------------
class AbsCache {
  private store = new Map<string, { data: unknown; expiresAt: number }>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown, ttlMs = 60_000) {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate() {
    this.store.clear();
  }
}

export const absCache = new AbsCache();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

export async function getConfig() {
  const settings = await SettingsRepository.get();
  if (!settings.abs_url || !settings.abs_api_key) return null;
  return { absUrl: settings.abs_url, apiKey: settings.abs_api_key };
}

// Fetch all sessions with pagination, up to 20,000
export async function fetchAllSessions(
  absUrl: string,
  apiKey: string
): Promise<{ sessions: any[]; truncated: boolean }> {
  const cacheKey = `sessions:${absUrl}`;
  const cached = absCache.get<{ sessions: any[]; truncated: boolean }>(cacheKey);
  if (cached) return cached;

  const all: any[] = [];
  let page = 0;
  const itemsPerPage = 1000;
  const maxPages = 20;
  let truncated = false;

  while (page < maxPages) {
    const data = await absRequest<{ sessions?: any[] }>(
      absUrl,
      apiKey,
      `/api/me/listening-sessions?page=${page}&itemsPerPage=${itemsPerPage}`
    );
    const sessions = (data.sessions ?? []).filter(
      (s: any) => s.deviceInfo?.clientName !== 'ABS-KoSync-Bridge'
    );
    all.push(...sessions);
    if (sessions.length < itemsPerPage) break;
    page++;
    if (page >= maxPages) {
      truncated = true;
      break;
    }
  }

  const result = { sessions: all, truncated };
  absCache.set(cacheKey, result);
  return result;
}

// Fetch and transform all books from ABS (cached, parallelised)
export async function fetchAbsBooks(config: { absUrl: string; apiKey: string }): Promise<any[]> {
  const cacheKey = `books:${config.absUrl}`;
  const cached = absCache.get<any[]>(cacheKey);
  if (cached) return cached;

  const [libData, me, sessionsResult] = await Promise.all([
    absRequest<{ libraries: any[] }>(config.absUrl, config.apiKey, '/api/libraries'),
    absRequest<{ mediaProgress?: any[] }>(config.absUrl, config.apiKey, '/api/me'),
    fetchAllSessions(config.absUrl, config.apiKey),
  ]);

  const { sessions: allSessions } = sessionsResult;

  const bookLibraries = (libData.libraries ?? []).filter(
    (lib: any) => lib.mediaType === 'book'
  );
  const itemResults = await Promise.all(
    bookLibraries.map((lib: any) =>
      absRequest<{ results: any[] }>(
        config.absUrl,
        config.apiKey,
        `/api/libraries/${lib.id}/items?limit=1000`
      )
    )
  );
  const allItems = itemResults.flatMap((d) => d.results ?? []);

  const progressMap: Record<string, any> = {};
  for (const p of me.mediaProgress ?? []) {
    progressMap[p.libraryItemId] = p;
  }

  const listeningTimeMap: Record<string, number> = {};
  for (const session of allSessions) {
    const itemId = session.libraryItemId as string;
    listeningTimeMap[itemId] = (listeningTimeMap[itemId] ?? 0) + (session.timeListening ?? 0);
  }

  const books = allItems.map((item: any) => {
    const meta = item.media?.metadata ?? {};
    const progress = progressMap[item.id] ?? {};
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
    };
  });

  absCache.set(cacheKey, books);
  return books;
}

// Attach per-book overrides (hidden/deleted/completed/reference_pages) from the local DB
async function applyOverrides(books: any[], showHidden: boolean): Promise<any[]> {
  const overrides = await AbsOverridesRepository.getAll();
  const overrideMap: Record<string, { hidden: boolean; deleted: boolean; completed: boolean; reference_pages: number | null; series: string | null; playback_speed: number | null }> = {};
  for (const o of overrides) {
    overrideMap[o.abs_item_id] = {
      hidden: Boolean(o.hidden),
      deleted: Boolean(o.deleted),
      completed: Boolean(o.completed),
      reference_pages: o.reference_pages ?? null,
      series: o.series ?? null,
      playback_speed: o.playback_speed ?? null,
    };
  }

  return books
    .map((b) => {
      const o = overrideMap[b.id] ?? { hidden: false, deleted: false, completed: false, reference_pages: null, series: null, playback_speed: null };
      return {
        ...b,
        hidden: o.hidden,
        deleted: o.deleted,
        completed: o.completed,
        reference_pages: o.reference_pages,
        series: o.series !== null ? o.series : b.series,
        playback_speed: o.playback_speed,
      };
    })
    .filter((b) => !b.deleted && (showHidden || !b.hidden));
}

// Custom cover helpers
const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];

function getCustomCoverPath(itemId: string): string | null {
  const dir = appConfig.coversPath;
  for (const ext of COVER_EXTENSIONS) {
    const p = path.join(dir, `abs-${itemId}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

// Export for use by scheduler
export async function absRefresh(): Promise<void> {
  const config = await getConfig();
  if (!config) return;
  absCache.invalidate();
  await Promise.all([
    fetchAbsBooks(config),
    fetchAllSessions(config.absUrl, config.apiKey),
  ]);
  await SettingsRepository.update({ abs_last_synced_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get('/books', async (req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }
  const showHidden = req.query.showHidden === 'true';
  try {
    const books = await fetchAbsBooks(config);
    res.json(await applyOverrides(books, showHidden));
  } catch (err: any) {
    console.error('ABS books error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf books' });
  }
});

router.get('/books/:id', async (req: Request<{ id: string }>, res: Response) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }
  try {
    const books = await fetchAbsBooks(config);
    const withOverrides = await applyOverrides(books, true);
    const book = withOverrides.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(book);
  } catch (err: any) {
    console.error('ABS book error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf book' });
  }
});

router.patch('/books/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const { hidden, deleted, completed, reference_pages, series, playback_speed } = req.body as {
    hidden?: boolean;
    deleted?: boolean;
    completed?: boolean;
    reference_pages?: number | null;
    series?: string | null;
    playback_speed?: number | null;
  };

  try {
    const update: Record<string, boolean | number | string | null> = {};
    if (hidden !== undefined) update.hidden = hidden;
    if (deleted !== undefined) update.deleted = deleted;
    if (completed !== undefined) update.completed = completed;
    if (reference_pages !== undefined) update.reference_pages = reference_pages;
    if (series !== undefined) update.series = series;
    if (playback_speed !== undefined) update.playback_speed = playback_speed;

    await AbsOverridesRepository.upsert(id, update);
    absCache.invalidate();
    res.json({ message: 'Updated' });
  } catch (err: any) {
    console.error('ABS book patch error:', err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

const coverUpload = multer({
  dest: appConfig.coversPath,
  fileFilter: (_req, file, cb) => {
    if (COVER_EXTENSIONS.some((ext) => file.originalname.toLowerCase().endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${COVER_EXTENSIONS.join(', ')} files are allowed`));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  '/books/:id/cover',
  coverUpload.single('file'),
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Missing file upload' });
      return;
    }

    try {
      const dir = appConfig.coversPath;
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const existing = getCustomCoverPath(id);
      if (existing) rmSync(existing, { force: true });

      const ext = path.extname(file.originalname) || '';
      await rename(file.path, path.join(dir, `abs-${id}${ext}`));

      absCache.invalidate();
      res.json({ message: 'Cover updated' });
    } catch (err: any) {
      console.error('ABS cover upload error:', err);
      res.status(500).json({ error: 'Failed to upload cover' });
    }
  }
);

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

router.get('/sessions', async (_req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }
  try {
    const { sessions, truncated } = await fetchAllSessions(config.absUrl, config.apiKey);
    res.json({ sessions, truncated });
  } catch (err: any) {
    console.error('ABS sessions error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf sessions' });
  }
});

router.get('/cover/:itemId', async (req: Request<{ itemId: string }>, res: Response) => {
  const { itemId } = req.params;

  const customPath = getCustomCoverPath(itemId);
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

// Verify ABS connection without saving credentials
router.post('/verify', async (req, res) => {
  const { abs_url, abs_api_key } = req.body as { abs_url?: string; abs_api_key?: string };

  if (!abs_url || !abs_api_key) {
    res.status(400).json({ ok: false, message: 'abs_url and abs_api_key are required' });
    return;
  }

  try {
    const me = await absRequest<{ username?: string }>(abs_url, abs_api_key, '/api/me');
    res.json({ ok: true, message: 'Connection successful', username: me.username });
  } catch (err: any) {
    res.json({ ok: false, message: err?.message ?? 'Connection failed' });
  }
});

// Invalidate server-side ABS cache and re-fetch
router.post('/refresh', async (_req, res) => {
  try {
    await absRefresh();
    res.json({ message: 'AudioBookShelf data refreshed' });
  } catch (err: any) {
    console.error('ABS refresh error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to refresh AudioBookShelf data' });
  }
});

export { router as absRouter };
