# Technical Fixes

Issues identified in code review. Each item includes what the problem is, where it lives, and what the fix looks like.

---

## 1. `GET /api/audiobookshelf/books` makes sequential HTTP requests

**Severity:** High — directly impacts books page load time.

**Location:** `apps/server/src/audiobookshelf/abs-router.ts`, `router.get('/books', ...)`

**Problem:** The endpoint makes 4+ HTTP requests to ABS in sequence: libraries list → N per-library item fetches → `/api/me` for progress → `/api/me/listening-sessions`. On a library with multiple libraries or a slow ABS server this adds up to several seconds per page load.

**Fix:** Parallelise the independent requests with `Promise.all`. The libraries list must come first, but once you have it the per-library item fetches, the `/api/me` call, and the sessions call are all independent and can run concurrently:

```ts
const [{ libraries }, me, sessionsData] = await Promise.all([
  absRequest('/api/libraries'),
  absRequest('/api/me'),
  absRequest('/api/me/listening-sessions?page=0&itemsPerPage=1000'),
]);
// then fetch per-library items in parallel:
const itemResults = await Promise.all(
  bookLibraries.map(lib => absRequest(`/api/libraries/${lib.id}/items?limit=1000`))
);
```

---

## 2. No caching on ABS API calls

**Severity:** High — every navigation to the books page triggers 4+ outbound HTTP requests to the ABS server.

**Location:** `apps/server/src/audiobookshelf/abs-router.ts`

**Problem:** There is no server-side cache. Every books page visit re-fetches all library data, all progress, and all sessions from ABS. This is slow and hammers the ABS server unnecessarily.

**Fix:** Add a simple in-memory cache with a configurable TTL (60 seconds is reasonable). A `Map` keyed by cache key with a `{ data, expiresAt }` shape is sufficient. Alternatively use a lightweight package like `lru-cache`. Cache at minimum the combined result of the books fetch since that is the most expensive. The sessions fetch for listening time is a good candidate too.

```ts
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlMs = 60_000) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
```

Invalidate the cache key when a PATCH (hide/delete) or cover upload is performed for that item.

---

## 3. Sessions hard-capped at 1000 — older listening time silently lost

**Severity:** High — becomes a data correctness issue over time. See also the dedicated feature request in `features.md`.

**Location:** `apps/server/src/audiobookshelf/abs-router.ts` (two places: `router.get('/books', ...)` and `router.get('/sessions', ...)`)

**Problem:** Both the books endpoint (for `listeningTime` calculation) and the sessions proxy endpoint fetch at most 1000 sessions. Users who accumulate more than 1000 sessions will have listening time understated and calendar/stats data incomplete, with no indication that data is missing.

**Fix (short term):** After fetching page 0, check if `sessions.length === itemsPerPage`. If so, fetch additional pages until a page comes back with fewer items than requested, then concatenate. Add a hard ceiling (e.g., 10 pages / 10,000 sessions) to avoid an infinite loop if the ABS API behaves unexpectedly.

**Fix (longer term):** See the pagination feature description in `features.md` for a more complete approach using a dedicated paginated endpoint.

---

## 4. Settings API returns secrets (passwords and API keys) to the browser

**Severity:** Medium — low risk for a purely self-hosted single-user app but a real concern if the app is ever shared or exposed.

**Location:** `apps/server/src/settings/settings-router.ts` `GET /`, `apps/web/src/api/settings.ts`, `apps/web/src/pages/settings-page/settings-page.tsx`

**Problem:** `GET /api/settings` returns `webdav_password` and `abs_api_key` in plaintext. The settings page reads them back to pre-populate the input fields. Anyone who can reach the API (or intercept a response) gets the credentials.

**Fix:** Change the GET response to mask secret fields — return an empty string or a `isSet: boolean` flag instead of the actual value. Update the settings page to show a placeholder (e.g., `"••••••••"` or `"(saved)"`) when a value is already set and only send the new value on PUT if the user has actually changed it. The PUT endpoint should treat an empty string as "leave unchanged" and a real value as "update".

---

## 5. `getCustomCoverPath` does a full `readdir` on every audiobook cover request

**Severity:** Low-Medium — becomes noticeable as the covers directory grows.

**Location:** `apps/server/src/audiobookshelf/abs-router.ts`, `getCustomCoverPath()`

**Problem:** Every request to `/api/audiobookshelf/cover/:itemId` reads all files in the covers directory to find one that starts with `abs-{itemId}`. On a system with many covers this is an unnecessary filesystem scan.

**Fix:** Check for each supported extension directly using `existsSync`, which avoids reading the directory:

```ts
async function getCustomCoverPath(itemId: string): Promise<string | null> {
  const dir = absCoversPath();
  for (const ext of ['.jpg', '.jpeg', '.png', '.gif']) {
    const p = path.join(dir, `abs-${itemId}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}
```

---

## 6. No concurrency protection on WebDAV sync

**Severity:** Medium — unlikely in normal use but would corrupt data if triggered.

**Location:** `apps/server/src/sync/sync-router.ts`

**Problem:** Two simultaneous POST requests to `/api/sync/webdav` (e.g., double-clicking the sync button) would both download the SQLite file, both call `uploadStatisticData` concurrently, and potentially interleave writes to the KoInsight database.

**Fix:** Add a module-level lock flag:

```ts
let syncInProgress = false;

router.post('/webdav', async (_req, res) => {
  if (syncInProgress) {
    res.status(409).json({ error: 'Sync already in progress' });
    return;
  }
  syncInProgress = true;
  try {
    // ... existing sync logic
  } finally {
    syncInProgress = false;
  }
});
```

On the frontend, the sync button in the navbar already has a loading state — also disable it while in progress to prevent double-clicks.

---

## 7. `abs_book_overrides` migration may not run automatically on deploy

**Severity:** Medium — the PATCH (hide/delete) and cover upload routes will throw a SQLite "no such table" error if the migration hasn't run.

**Location:** `apps/server/src/db/migrations/20260506000001_create_abs_book_overrides.ts`

**Problem:** Whether this migration runs automatically depends on how the Docker entrypoint is configured. If the server starts before running `knex migrate:latest`, the new table won't exist.

**Fix:** Verify that the Docker entrypoint (or `apps/server/src/index.ts` / startup file) runs `knex.migrate.latest()` before the Express server starts listening. If not, add it. This should already be the pattern for the settings table migration — confirm the same mechanism covers the new migration.

---

## 8. Settings PUT endpoint has no input validation

**Severity:** Low — bad data causes confusing errors at sync time rather than at save time.

**Location:** `apps/server/src/settings/settings-router.ts`

**Problem:** Any string is accepted as a URL, path, or API key. A typo like `htps://` as the WebDAV URL gets saved silently and only fails when sync is attempted, with a generic fetch error.

**Fix:** Add basic validation before saving: check that URLs parse as valid `URL` instances, check that `webdav_db_path` starts with `/` or warn if it doesn't, and return a 400 with a descriptive message on failure. This pairs well with the "Verify connection" feature described in `features.md`.

---

## 9. `abs-book-page` loads all books and all sessions to view one book

**Severity:** Medium — correct but inefficient; becomes slower as library and session count grow.

**Location:** `apps/web/src/pages/abs-book-page/abs-book-page.tsx`

**Problem:** `useAbsBooks({ showHidden: true })` fetches every book in the library just to `find` one by ID. `useAbsSessions()` fetches every session to `filter` by `libraryItemId`. SWR caches these so repeat visits are fast, but the initial load is heavier than necessary.

**Fix:** Add a `GET /api/audiobookshelf/books/:id` endpoint on the server that returns a single book (with its `listeningTime` and overrides). For sessions, either add a `?libraryItemId=` filter server-side or accept that SWR caching makes the current approach acceptable for now. The single-book endpoint is the higher-value change.

---

## 10. Stats page loading state doesn't include `useAbsSessions`

**Severity:** Low — causes a brief flash of empty/incorrect data in the audiobook stats view.

**Location:** `apps/web/src/pages/stats-page/stats-page.tsx`, `isLoading` computation

**Problem:**
```ts
const isLoading = (showEbooks && (booksLoading || statsLoading)) || (showAudiobooks && absLoading);
```
`absLoading` only covers `useAbsStats`. `useAbsSessions` has its own loading state that is ignored. The listening history calendar and weekly stats render with empty session data until sessions arrive.

**Fix:** Destructure the loading state from `useAbsSessions` and include it:
```ts
const { data: absSessions = [], isLoading: absSessionsLoading } = useAbsSessions();
// ...
const isLoading =
  (showEbooks && (booksLoading || statsLoading)) ||
  (showAudiobooks && (absLoading || absSessionsLoading));
```

---

## 11. `AbsStatsCard` session prop type is unnecessarily complex

**Severity:** Low — cosmetic/maintainability issue.

**Location:** `apps/web/src/pages/abs-book-page/abs-book-page.tsx`, `AbsStatsCard` component props

**Problem:**
```ts
sessions: ReturnType<typeof useAbsSessions>['data'];
```
This couples the component's interface to the SWR hook's return shape. If the hook changes, the component's prop type silently changes too.

**Fix:** Import `AbsSession` and use it directly:
```ts
import { AbsBook, AbsSession, useAbsBooks, useAbsSessions } from '../../api/audiobookshelf';
// ...
function AbsStatsCard({ book, sessions }: { book: AbsBook; sessions: AbsSession[] })
```

---

## 12. `ReadingCalendar` fetches ebook data even when `showEbookData={false}`

**Severity:** Low — minor unnecessary data fetch on first load of audiobook stats view.

**Location:** `apps/web/src/components/statistics/reading-calendar.tsx`

**Problem:** `usePageStats()` is called unconditionally at the top of the component regardless of the `showEbookData` prop. The result is discarded when `showEbookData={false}`, but the SWR fetch still happens on first load.

**Fix:** Either move `usePageStats()` inside a conditional (not straightforward since hooks can't be conditional) or restructure so the hook is only in the ebook component variant. The simplest approach: split into two components — `ReadingCalendar` (ebook-aware, uses `usePageStats`) and `ListeningCalendar` (pure, accepts `absData` only, no hook dependency). The stats page would then use the correct one per mode.

---

## 13. `AbsStats` type is imported but never used

**Severity:** Low — dead import, cosmetic.

**Location:** `apps/web/src/api/audiobookshelf.ts`

**Problem:** The `AbsStats` interface is exported from `audiobookshelf.ts` but is no longer imported by any consumer after the stats page refactor. The type itself is still valid (used implicitly via `useAbsStats`'s return type) but the explicit named export is referenced nowhere.

**Fix:** No action needed unless it causes a lint warning — the type is used implicitly. If a `no-unused-exports` lint rule is added in the future, remove the explicit import from `stats-page.tsx` (already done) and optionally mark the export as `@internal`.

---

## 14. `abs-books-section.tsx` is an orphaned file

**Severity:** Low — dead code, no functional impact.

**Location:** `apps/web/src/pages/books-page/abs-books-section.tsx`

**Problem:** This file was created early in development as an intermediate step and was superseded by the unified `BooksTable` approach. It is no longer imported anywhere.

**Fix:** Delete the file:
```
rm apps/web/src/pages/books-page/abs-books-section.tsx
```
