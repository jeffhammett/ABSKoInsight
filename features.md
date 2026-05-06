# Feature Descriptions

Planned features for future development. Each entry describes what the feature does, the data it needs, and implementation notes.

---

## 1. Home Page with Reading Streak and Currently Reading/Listening

### What it does
Replaces the current redirect-to-books default route with a real home page. Shows two things at a glance: your current activity streak and the books/audiobooks you are actively in the middle of.

### Reading Streak
A streak is the number of consecutive calendar days (in the user's local timezone) on which any reading or listening activity was recorded.

- **Both / E-books only / Audiobooks only** — a data source toggle (defaulting to Both) controls which activity types count toward the streak.
- Display: current streak as a large number with flame/calendar icon, longest streak ever as a secondary stat.
- A day counts if any reading session (`page_stats` entry) or any ABS listening session (`session.timeListening > 0`) exists for that local date.
- The streak resets if today and yesterday both have no activity (i.e., the streak is broken when you wake up the next day with none the day before).

**Data sources:**
- Ebook: `page_stats` table, grouped by `startOfDay(start_time)`.
- Audiobook: ABS sessions, grouped by `startOfDay(new Date(session.startedAt))` in browser timezone.

**Backend:** A new `GET /api/stats/streak` endpoint that accepts a `source=ebook|audiobook|both` query param and returns `{ current: number, longest: number }`. Computing this server-side avoids sending all raw stats to the client just to count days.

### Currently Reading / Listening Cards
A grid of book cards for items where `progress > 0%` and `progress < 100%` (and not marked as completed — see feature #2).

- Show cover, title, author, progress bar, and last opened/listened date.
- Clicking navigates to the book's detail page.
- Section header: "Currently reading" (ebooks), "Currently listening" (audiobooks), or a combined section when Both is selected.
- If nothing is in progress, show a friendly empty state.
- Order by `lastActivityMs` descending (most recently touched first).

**Data source:** Already available from `useBooks()` and `useAbsBooks()` — just filter client-side. No new API needed.

### Route
The home page should live at `/` (or redirect `/` → `/home`). Update `RoutePath.HOME` and the navbar link. The current behaviour redirects `/` to `/books` which would no longer be correct.

---

## 2. "Completed" Toggle on Book and Audiobook Manage Data Pages

### What it does
Lets a user mark a book as completed independently of the actual reading/listening data. This handles cases like:
- A book read before KoInsight was set up (no stats, but it is finished).
- An audiobook started on another platform (progress imported at a partial %, listening time low).
- A book where you skipped the last few pages/minutes.

When "Completed" is toggled on:
- The progress ring and progress bar show **100%** on the book's detail page and the books list.
- The actual `unique_read_pages`, `currentTime`, and `listeningTime` values are **unchanged** — they remain accurate for stats calculations.
- The book does **not** appear in the "Currently reading/listening" section on the home page.
- The books list should display a "Completed" badge or checkmark to distinguish these from genuinely 100%-read books.

### Ebook implementation
- Add a `completed_override BOOLEAN DEFAULT 0` column to the `books` table via a new migration.
- `BookHide` component pattern: a new `BookComplete` component in `book-page-manage/` with a `Switch` that calls a `PUT /api/books/:id/complete` endpoint.
- `BookPage` and `BooksTable`: when `book.completed_override` is true, substitute `progressPct = 100` for display only.

### Audiobook implementation
- Add a `completed` column to `abs_book_overrides` table (new migration, or add to the existing table).
- New `AbsBookComplete` component in `abs-book-page/` mirroring the ebook version.
- Pass `{ completed: true }` via the existing `PATCH /api/audiobookshelf/books/:id` endpoint (add `completed` to the handler and `AbsOverridesRepository.upsert`).
- Frontend: when `book.completed` is true from the API, display `progressPct = 100`.

---

## 3. Sort by Completion Percent on the Books Page

### What it does
Adds "Completion %" as a sort option in the sort-by dropdown on the main books page, working correctly for both ebooks (pages-based) and audiobooks (time-based percent).

### Current state
The `SortKey` type in `books-page.tsx` is `'title' | 'authors' | 'totalReadTime' | 'lastActivityMs'`. The `UnifiedBook` type already has a `progressPct: number` field populated for both ebooks and audiobooks.

### Implementation
1. Add `'progressPct'` to the `SortKey` type.
2. Add a case to the sort switch:
   ```ts
   case 'progressPct':
     return (a.progressPct - b.progressPct) * dir;
   ```
3. Add the label to `sortOptions`:
   ```ts
   { label: 'Completion %', value: 'progressPct' }
   ```

No backend changes needed. The default sort direction for this option should probably be `desc` (most complete first) — consider auto-setting direction when this key is selected.

---

## 4. Series Tracking Across Ebooks and Audiobooks

### What it does
Surfaces series information throughout the app, letting users see how far through a series they are whether they read the ebooks, listen to the audiobooks, or mix both.

### Data available
- **Ebooks:** `book.series` (string, already in the DB and displayed on the book detail page).
- **Audiobooks:** `media.metadata.seriesName` from ABS (already extracted and exposed as `absBook.series`).

### Features to build

**Series grouping on the Books page**
- A "Group by series" toggle. When active, books are grouped by series name with a series header row showing: series name, total books, books read/completed, total reading/listening time.
- Books without a series appear in an "Ungrouped" section.
- Matching should normalise case and strip leading "The " for comparison.

**Series detail page** (`/series/:name`)
- Lists all books in the series (ebooks and audiobooks interleaved by series order if available).
- Shows overall series completion: e.g., "4 of 7 books read (57%)".
- Links to individual book/audiobook detail pages.
- Cover grid or table view.

**Series progress on book detail pages**
- On the ebook and audiobook detail pages, if `book.series` is set, show a "Part of [Series Name]" link that navigates to the series page.

**Cross-source matching**
- A book and its audiobook counterpart often share the same series name from ABS and KOReader metadata. Match on series name (normalised) to show unified series progress even if the user reads some books as ebooks and others as audiobooks.
- Optionally allow manual linking on the series detail page for cases where metadata doesn't match.

### Implementation notes
- No new backend table is strictly required for the basic version. Series data can be derived at query time from the existing `books` table (`series` column) and ABS books endpoint.
- For a richer series page, a `series` table with `name`, `total_books` could be useful later.
- Series ordering (book 1, 2, 3...) is not reliably available in metadata; may need to accept alphabetical or manual ordering.

---

## 5. Auto Sync Interval for WebDAV

### What it does
Adds a setting to automatically trigger a WebDAV sync on a schedule instead of requiring manual button clicks. Once configured, the server will sync in the background at the specified interval.

### Settings UI (Settings page)
Add a new field in the WebDAV section:
- **Auto sync interval** — a `Select` with options: Disabled, Every 1 hour, Every 6 hours, Every 12 hours, Every 24 hours.
- Default: Disabled.
- Only shown when a WebDAV URL and path are configured.

### Backend
1. Add `webdav_sync_interval_hours INTEGER DEFAULT 0` (0 = disabled) to the `settings` table via migration.
2. On server startup (and whenever settings are saved), read the interval and schedule a repeating sync using `setInterval`. If an interval is already running when settings are updated, clear it and set a new one.
3. The sync logic already exists in `sync-router.ts` — extract it into a shared `SyncService.syncWebdav()` function that both the route handler and the scheduler call.
4. Track `last_synced_at` in the settings table and expose it in the GET response so the UI can show "Last synced: 2 hours ago".

### UI feedback
- Show "Last synced: X ago" below the WebDAV section in Settings.
- The navbar sync button should still work as a manual override regardless of auto-sync state.

---

## 6. Connection Verification Buttons and ABS Sync Notification in Settings

### What it does
Two quality-of-life improvements on the Settings page that give immediate feedback when configuring integrations.

### Verify WebDAV connection
A "Test connection" button next to the WebDAV save button. When clicked:
- Sends a `POST /api/sync/verify-webdav` request (new endpoint).
- The endpoint performs the WebDAV fetch (HEAD or GET of just the first byte to avoid downloading the full DB) and returns success/failure with a human-readable message.
- Shows a green success notification ("WebDAV connection successful — found statistics.sqlite3") or a red error notification with the status code/message.
- The verify action should save the current field values first (or send them as part of the verify request without persisting) so the user can test before committing.

**New endpoint:** `POST /api/sync/verify-webdav` — accepts the same fields as the settings form in the request body, attempts a `HEAD` request to the configured URL, returns `{ ok: boolean, message: string }`. Does not write to the database.

### Verify ABS connection
A "Test connection" button next to the ABS save button. When clicked:
- Sends a `POST /api/audiobookshelf/verify` request (new endpoint).
- The endpoint calls `GET /api/ping` or `GET /api/me` on the ABS server with the provided credentials.
- Returns success (with the authenticated user's username for confirmation) or failure.

**New endpoint:** `POST /api/audiobookshelf/verify` — accepts `{ abs_url, abs_api_key }` in body, returns `{ ok: boolean, message: string, username?: string }`.

### ABS sync notification
Currently the WebDAV sync button in the navbar shows a success/failure toast. The ABS integration doesn't have a manual sync button — data is fetched on demand via SWR. Consider:
- Adding a manual "Refresh ABS data" button in the navbar footer alongside the WebDAV sync button (or in Settings).
- When clicked, it invalidates all `abs-*` SWR keys (`mutate(key => typeof key === 'string' && key.startsWith('abs'))`) and shows a "AudioBookShelf data refreshed" notification.
- This gives users a way to force-pull updated ABS data without navigating away and back.

---

## 7. Devices Tab

### What it does
A new top-level navigation item ("Devices") that shows a breakdown of reading and listening time per device.

### What counts as a device
- **KOReader devices:** Each physical device that has synced stats. The `devices` table already exists in KoInsight with device names from KOReader's device data. The `page_stats` table links sessions to books; device data is in `book_device` / `device` tables.
- **ABS clients:** AudioBookShelf sessions have a `deviceInfo` object (or `deviceDescription` field in the API) identifying the client app (e.g., "Audiobookshelf-Android", "Web Player"). Use this to group ABS sessions by client.

### Display
A table or card grid. Each row/card:
- **Device name** (from KOReader device name or ABS `deviceDescription`)
- **Type** — "E-book reader" (KOReader) or "Audiobook client" (ABS)
- **Total time** — sum of all reading/listening time on that device
- **Last active** — most recent session date on that device
- No per-book breakdown on this page — it's a device-level summary only.

Sort by total time descending by default.

### Implementation notes

**Ebook devices:** The `devices` table already tracks `name` per device. Join through `page_stats → book_device → device` (or however the existing schema links them) to sum `duration` per device. New endpoint: `GET /api/stats/devices` returning `[{ name, type: 'ebook', totalTime, lastActive }]`.

**ABS devices:** The ABS listening session object includes device information. The `GET /api/me/listening-sessions` response should include a `deviceInfo.name` or `deviceDescription` field per session. Aggregate `timeListening` per unique device description. This can be computed client-side from the existing `useAbsSessions()` data, or handled server-side in the `/audiobookshelf/stats` endpoint.

**New route:** `RoutePath.DEVICES = '/devices'` with a `DevicesPage` component. Add to navbar between Calendar and Stats (or after Stats).

---

## 8. ABS Session Pagination (Fix Listening Time Undercount)

### What it does
Fixes a data correctness issue where users with more than 1000 ABS listening sessions have their older listening time silently omitted from all calculations.

### The problem in detail
The server currently fetches sessions with `?page=0&itemsPerPage=1000`. ABS returns up to 1000 sessions per request. A user who has listened for several years will have more. The 1000th session cutoff means:
- `listeningTime` on the books list is understated for books listened to early on.
- The stats page listening history calendar has gaps for older dates.
- The "last 7 days" and streak calculations are unaffected (recent sessions are on page 0), but historical stats are incomplete.
- There is no warning shown to the user that data is missing.

### Fix

**Server-side (authoritative fix):** In `abs-router.ts` where sessions are fetched for `listeningTime` calculation, paginate through all pages:

```ts
async function fetchAllSessions(absUrl: string, apiKey: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  const itemsPerPage = 1000;
  while (true) {
    const data = await absRequest<{ sessions?: any[] }>(
      absUrl, apiKey,
      `/api/me/listening-sessions?page=${page}&itemsPerPage=${itemsPerPage}`
    );
    const sessions = data.sessions ?? [];
    all.push(...sessions);
    if (sessions.length < itemsPerPage) break;
    page++;
    if (page > 20) break; // safety ceiling: 20,000 sessions max
  }
  return all;
}
```

**Client-side sessions proxy (`GET /api/audiobookshelf/sessions`):** Update the sessions proxy endpoint to also paginate and return all sessions (not just the first 1000), or accept a `fetchAll=true` query param. The calendar page and stats page both call this and would benefit.

**Caching interaction:** Full session pagination makes the books endpoint slower (fix #2 — caching — becomes more important once this is in place). Cache the paginated result for 60 seconds.

**Detection:** Add a `truncated: boolean` field to the sessions response when the per-page limit was hit, so the frontend can show a warning: "Some older sessions may not be included."
