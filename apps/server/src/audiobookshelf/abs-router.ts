import { Router } from 'express';
import { SettingsRepository } from '../settings/settings-repository';

const router = Router();

async function absRequest<T>(absUrl: string, apiKey: string, path: string): Promise<T> {
  const base = absUrl.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
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

router.get('/books', async (_req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }

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

    const books = allItems.map((item: any) => {
      const meta = item.media?.metadata ?? {};
      const progress = progressMap[item.id] ?? {};
      return {
        id: item.id,
        title: meta.title ?? 'Unknown',
        authors: meta.authorName ?? '',
        duration: item.media?.duration ?? 0,
        addedAt: item.addedAt ?? 0,
        progress: progress.progress ?? 0,
        currentTime: progress.currentTime ?? 0,
        isFinished: progress.isFinished ?? false,
        finishedAt: progress.finishedAt ?? null,
        lastUpdate: progress.lastUpdate ?? null,
        source: 'audiobookshelf',
      };
    });

    res.json(books);
  } catch (err: any) {
    console.error('ABS books error:', err);
    res.status(502).json({ error: err?.message ?? 'Failed to fetch AudioBookShelf books' });
  }
});

router.get('/stats', async (_req, res) => {
  const config = await getConfig();
  if (!config) {
    res.status(400).json({ error: 'AudioBookShelf settings not configured' });
    return;
  }

  try {
    const stats = await absRequest<any>(
      config.absUrl,
      config.apiKey,
      '/api/me/listening-stats'
    );
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

export { router as absRouter };
