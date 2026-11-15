# Upstream changes to bring in

This fork is based on [Ko-Insight/KoInsight](https://github.com/Ko-Insight/KoInsight) at
commit `d5592a3` ("Harden sync (#99)", 2026-03-02). Upstream was archived in October 2026
(see `dda2240`) and recommends [BookOrbit](https://bookorbit.app/) as a replacement. After
evaluating BookOrbit (it only offers a one-time Audiobookshelf import, not live sync), this
fork stays as is. This document records which of the 11 upstream commits made after the fork
point are worth bringing in, and exactly how to do it.

Reviewed on 2026-11-14 against upstream `master` at `dda2240`.

## Setup

```sh
git remote add upstream https://github.com/Ko-Insight/KoInsight.git   # if not already added
git fetch upstream
git switch -c upstream-picks
```

Commits are cherry-picked one at a time instead of merging `upstream/master`. Merging would pull
in the release pipeline, the version bump and README changes this fork doesn't want, plus a
`package-lock.json` conflict.

## Summary

| # | Commit(s) | What | Decision |
|---|-----------|------|----------|
| 1 | `b666ea0` (#124) + `d59690f` (#129) | Pages-read tooltip on calendars; book progress ring uses the latest page reached | **Bring in**, with manual conflict resolution and an audiobook extension (below) |
| 2 | `2755c62` (#128) | KOReader plugin: validate the server URL in settings | **Bring in**, applies cleanly |
| 3 | `ac70788`, `2296520` | Remove unused dependencies; fix the React types version | **Bring in**, but edit `package.json` by hand (lockfile conflicts) |
| - | `1f62b44` | Dev env: `.env.example` files, Vite proxy, backend on port 3001 in dev | Optional, not planned. Changes dev ports; would need checking against the ABS and scheduler setup |
| - | `2c77b67` (#122) | "Show Hidden Books" button on the empty books page | Skip. Our books page already has a show-hidden switch, and our empty-state text differs |
| - | `2624bea`, `812231a`, `f63cf05`, `dda2240` | Release workflow, `tag-release.sh`, v0.2.3 bump, Node 22 in CI, archive notice in README | Skip. Upstream release housekeeping only |

Suggested order: 2, then 3, then 1, so the risky one goes last.

---

## 2. KOReader plugin URL validation (`2755c62`)

```sh
git cherry-pick 2755c62
```

This touches only `plugins/koinsight.koplugin/settings.lua`, which this fork has not changed, so
it applies cleanly. The **Apply** button in the plugin's server settings will now refuse an
empty URL, or one that doesn't start with `http://` or `https://`, and show an `InfoMessage`.

To verify: copy the plugin to a KOReader device or emulator, open KoInsight → Settings →
Server URL, and try `""`, `example.com` and `http://host:3000`. Only the last one should save.

Users only get it when they reinstall the plugin from the web UI download or copy it over by
hand.

---

## 3. Dependency cleanup (`ac70788`, `2296520`)

Don't cherry-pick these. Both commits rewrite `package-lock.json` heavily, and that conflicts
with this fork's lockfile. Make the same `package.json` edits by hand, then regenerate the
lockfile.

### `apps/server/package.json`

Remove these three. All are unused in this fork, as of 2026-11-14:

| Package | Section | Why it's safe |
|---------|---------|---------------|
| `sqlite3` `5.1.7` | dependencies | The server uses `better-sqlite3` through knex. `grep -rn "sqlite3'" apps/server/src` only matches `.sqlite3` file names in `config.ts` and `upload-router.ts`, not an import. |
| `@types/bcrypt` `6.0.0` | devDependencies | The server uses `bcryptjs` (which ships its own types), not `bcrypt`. |
| `tsx` `4.21.0` | devDependencies | Dev runs through `nodemon` + `ts-node`. Nothing calls `tsx`. |

Before removing them, run the check below again, in case new code has started using them since
this was written:

```sh
grep -rnE "from '(sqlite3|bcrypt|tsx)'|require\('(sqlite3|bcrypt)'\)|\btsx " apps/server/src apps/server/package.json Dockerfile
```

Keep `bcryptjs`. It is a real dependency.

### `apps/web/package.json`

The app runs React **18.3.1**, but the type packages are for React 19. Change:

```diff
-    "@types/react": "19.0.2",
-    "@types/react-dom": "19.0.2",
+    "@types/react": "18.3.31",
+    "@types/react-dom": "18.3.7",
```

**Fork-specific note:** going down to the React 18 types can show type errors in this fork's
code, which upstream never had. The new pages (`abs-book-page/*`, `stats-page/*`, `home-page`,
`series-*`, `settings-page`, `day-timeline.tsx`) were written against the React 19 types. The
common differences:
- `useRef<T>()` needs an argument in 19 but not in 18.
- `JSX` is imported from `'react'` in this codebase (`import { JSX } from 'react'`). That works
  with `@types/react` 18.3.x, so it should be fine.
- `ref` as a plain prop on function components only works in 19. In 18 you need `forwardRef`.

Fix any errors `tsc` reports. Don't keep the 19 types: they describe APIs the React 18 runtime
doesn't have.

### Regenerate and verify

```sh
npm install                      # rewrites package-lock.json
npm run build                    # turbo builds common, server and web, including type checks
npm --workspace=server test
docker build -t abskoinsight:test .   # the Dockerfile runs npm install from package.json files
git add apps/server/package.json apps/web/package.json package-lock.json
git commit -m "Remove unused deps and match React types to React 18 (from upstream ac70788, 2296520)"
```

---

## 1. Pages-read tooltip and progress ring (`b666ea0` + `d59690f`)

### What upstream changed

1. **Moved `apps/server/src/utils/ranges.ts` to `packages/common/utils/ranges.ts`** so the web app
   can use `normalizeRanges`. `books-service.ts` and `ranges.test.ts` now import from
   `@koinsight/common/utils/ranges` (`d59690f` is the test import fix).
2. **New `apps/web/src/utils/book-progress.ts`:**
   - `getLatestReadPage(book)` returns the highest page reached on the **most recent reading
     day**, scaled to `reference_pages` when one is set.
   - `getReferencePageRanges(book, stats)` turns page stats into merged
     `[startPage, endPage]` ranges, scaled to `reference_pages`.
   - `getReferencePageRange(book, stats)` returns the overall min and max of those ranges.
3. **New `apps/web/src/components/calendar/calendar-book-day.tsx`.** It renders
   `🕒 1h 05m` with a Mantine `Tooltip`: `Pages read: 120 - 145 (25 pages)`.
4. **Used it in** `book-page-calendar.tsx` and `calendar-page.tsx`.
5. **The `book-page.tsx` progress ring** shows `getLatestReadPage(book) / bookPages` instead of
   `unique_read_pages / bookPages`.

### Conflicts in this fork

A trial merge (`git merge-tree --write-tree master upstream/master`) shows conflicts in:

- `apps/web/src/pages/book-page/book-page-calendar.tsx`
- `apps/web/src/pages/book-page/book-page.tsx`
- `apps/web/src/pages/calendar-page.tsx`

The `books-service.ts` import change and the file move apply cleanly. `packages/common` needs
no config changes: its `tsconfig.json` already uses `"include": ["**/*.ts"]`, and the server
already imports from `@koinsight/common/types` the same way.

### Step 1: cherry-pick and resolve

```sh
git cherry-pick b666ea0
```

In every conflict, keep this fork's version and add upstream's piece to it. Don't take
upstream's file wholesale.

#### `book-page-calendar.tsx`

This fork renders duration **plus** `<DayTimeline>`. Upstream swaps the duration for
`<CalendarBookDay>`. Result:

```tsx
import { CalendarBookDay } from '../../components/calendar/calendar-book-day';
import { DayTimeline } from '../../components/calendar/day-timeline';
// drop the now-unused IconClock, sum, getDuration and shortDuration imports

      dayRenderer={(data) => (
        <>
          <CalendarBookDay book={book} data={data} />
          <DayTimeline readingEvents={data.events} listeningEvents={[]} />
        </>
      )}
```

#### `calendar-page.tsx`

This fork's version is a full rewrite: `DataSourceToggle`, a `DayData` of
`{ readingEvents, listeningEvents }`, `IconBook`/`IconHeadphones` rows and `DayTimeline`.
Keep **all** of it. Only the ebook row changes. Replace

```tsx
              <IconClock size={14} /> {shortDuration(getDuration(bookDuration))}
```

with

```tsx
              <CalendarBookDay
                book={book}
                data={{ events: data.readingEvents.filter((e) => e.book_md5 === book.md5) }}
              />
```

and delete the `bookDuration` variable. `CalendarBookDay` computes the duration itself.
Don't bring in upstream's `as BookWithData[]` cast. `useBooks()` returns `Book[]`, which is
fine once step 2 below loosens the prop type. The audiobook row (`IconHeadphones`) is handled
in step 4.

#### `book-page.tsx` (`StatsCard`)

This fork has:

```tsx
const displayedReadPages = book?.completed_override ? bookPages : (book?.unique_read_pages ?? 0);
```

and the ring label still prints `{book.unique_read_pages} / {bookPages}`. That's a bug: a book
marked complete shows 100%, but the text under it shows a lower page count.

Resolve to:

```tsx
import { getLatestReadPage } from '../../utils/book-progress';

const displayedReadPages = book?.completed_override ? bookPages : getLatestReadPage(book);
const progressPercent = bookPages > 0 ? Math.round((displayedReadPages / bookPages) * 100) : 0;
```

Then use `progressPercent` for the big number, `displayedReadPages` for the
`{x} / {bookPages} pages read` label, and `bookPages > 0 ? (displayedReadPages / bookPages) * 100 : 0`
for the ring section. Keep this fork's `readingDays` calculation, which counts distinct
`startOfDay` values in `book.stats`. Don't take upstream's `Object.keys(book.read_per_day)`.

**Behavior change:** the ring now means "where I am", not "how many distinct pages I've
seen". If you jump ahead and then go back on the latest day, the ring shows the earlier
position. That's intended upstream, because `unique_read_pages` undercounts when you skip
around. If you'd rather keep the old meaning, use `Math.max(getLatestReadPage(book),
book.unique_read_pages)`.

```sh
git add -A && git cherry-pick --continue
git cherry-pick d59690f   # ranges.test.ts import path, should be clean
```

### Step 2: loosen `CalendarBookDay`'s prop type

Upstream types `book` as `BookWithData`, but `getReferencePageRanges` only reads
`book.reference_pages`. Change it in `book-progress.ts` and `calendar-book-day.tsx`:

```ts
type RefPagesBook = Pick<Book, 'reference_pages'>;

export function getReferencePageRanges(book: RefPagesBook, stats: PageStat[]): Range[]
export function getReferencePageRange(book: RefPagesBook, stats: PageStat[]): Range
// CalendarBookDay props: book: RefPagesBook
```

`getLatestReadPage` keeps `BookWithData`, because it needs `book.stats`.

Also guard `getReferencePageRange` against an empty `stats` list. Upstream returns
`[Infinity, -Infinity]` in that case. In `calendar-page.tsx` a day row always has at least one
event, but the guard costs nothing:

```ts
if (ranges.length === 0) return [0, 0];
```

### Step 3: verify the ebook side

```sh
npm run build
npm --workspace=server test      # ranges tests now import from common
npm run dev
```

- Book page → Calendar tab: hover a day. The tooltip shows a page range, the timeline bar still
  renders underneath, and pages are scaled when **Reference pages** is set under Manage.
- Book page: the ring percentage and the `x / y pages read` text agree. A book with
  `completed_override` shows 100% and `y / y`.
- Calendar page, data source **Ebooks** and **Both**: ebook rows have the tooltip, audiobook rows
  are unchanged, and the timeline still renders.

### Step 4: audiobook extension

Upstream's feature reads KOReader page numbers. Audiobookshelf sessions have none, but this
fork already estimates pages for audiobooks: each audiobook can have `reference_pages` and
`playback_speed` overrides (see `abs-book-reference-pages.tsx` and `abs-book-playback-speed.tsx`).
The same estimate appears **six times** in the stats pages:

```ts
// day-stats.tsx, week-stats.tsx, month-stats.tsx, abs-week-stats.tsx, abs-month-stats.tsx, abs-year-stats.tsx
pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
```

So the tooltip can work for audiobooks too, labeled as an estimate.

#### 4a. Expose the session's start position

`fetchAllSessions` in `apps/server/src/audiobookshelf/abs-router.ts` passes Audiobookshelf's raw
`/api/me/listening-sessions` objects through unchanged. Each one already includes `startTime`,
the book position in seconds when the session began, and `currentTime`, the position when it
ended. The web type is missing `startTime`. Add it to `AbsSession` in
`apps/web/src/api/audiobookshelf.ts`:

```ts
  startTime: number;   // position in the book (seconds) when the session started
  currentTime: number; // position in the book (seconds) when the session ended (already present)
```

No server change is needed. Spot-check one session in the browser's network tab to confirm
`startTime` is there before relying on it.

#### 4b. Add helpers to `apps/web/src/utils/book-progress.ts`

```ts
import { AbsBook, AbsSession } from '../api/audiobookshelf';

export const DEFAULT_ABS_PLAYBACK_SPEED = 1.5;

type AbsRefBook = Pick<AbsBook, 'reference_pages' | 'duration' | 'playback_speed'>;

/** Estimated pages listened in a session, at the book's playback speed. Returns 0 if no reference_pages. */
export function estimateAbsSessionPages(book: AbsRefBook, session: Pick<AbsSession, 'timeListening'>): number {
  if (!book.reference_pages || !book.duration) return 0;
  return session.timeListening * (book.playback_speed ?? DEFAULT_ABS_PLAYBACK_SPEED) * (book.reference_pages / book.duration);
}

/** Estimated page range covered by sessions, from the book positions (startTime and currentTime). */
export function getAbsReferencePageRange(book: AbsRefBook, sessions: AbsSession[]): Range | null {
  if (!book.reference_pages || !book.duration || sessions.length === 0) return null;
  const toPage = (seconds: number) => (seconds / book.duration) * book.reference_pages!;
  const ranges: Range[] = sessions.map((s) => {
    const start = s.startTime ?? Math.max(0, s.currentTime - s.timeListening * (book.playback_speed ?? DEFAULT_ABS_PLAYBACK_SPEED));
    return [toPage(Math.min(start, s.currentTime)), toPage(Math.max(start, s.currentTime))];
  });
  const merged = normalizeRanges(ranges);
  return [Math.min(...merged.map(([a]) => a)), Math.max(...merged.map(([, b]) => b))];
}
```

Note that position-based ranges (`startTime` to `currentTime`) don't depend on playback speed,
because they're positions in the book, not time spent. Speed only matters for the
`timeListening` fallback and for `estimateAbsSessionPages`. Position ranges also handle
rewinding and skipping correctly, which the time-based estimate can't.

Then **replace the six duplicated formulas** in the stats pages with `estimateAbsSessionPages`.
That keeps the default speed of `1.5` in one place. This is optional but cheap, and it ensures
the tooltip and the stats pages agree.

#### 4c. New `CalendarAbsDay` component

`apps/web/src/components/calendar/calendar-abs-day.tsx`, the same shape as `CalendarBookDay`:

```tsx
export function CalendarAbsDay({ book, sessions }: { book?: AbsRefBook; sessions: AbsSession[] }) {
  const duration = getDuration(sum(sessions.map((s) => s.timeListening)));
  const range = book ? getAbsReferencePageRange(book, sessions) : null;
  const content = (<span><IconClock size={14} /> {shortDuration(duration)}</span>);
  if (!range) return content;   // no reference_pages set: plain duration, no tooltip
  const [start, end] = range.map(Math.round);
  return <Tooltip label={`≈ Pages ${start} - ${end} (${end - start} pages, estimated)`}>{content}</Tooltip>;
}
```

The `≈` and "estimated" wording keep audiobook estimates distinct from the real KOReader page
counts.

#### 4d. Wire it in

- **`abs-book-page-calendar.tsx`:** add a `book: AbsBook` prop (`abs-book-page.tsx` already has
  `book`, so pass it at line ~83 where `<AbsBookPageCalendar sessions={sessions} />` is rendered).
  Replace the inline `IconClock` duration with `<CalendarAbsDay book={book} sessions={data.sessions} />`,
  and keep `<DayTimeline>`.
- **`calendar-page.tsx`:** the listening rows group by `libraryItemId` into `{ title, seconds }`.
  Change that grouping to collect the sessions themselves (`{ title, sessions: AbsSession[] }`),
  look up the book with `useAbsBooks()` (`absBooks.find((b) => b.id === itemId)`), and render
  `<CalendarAbsDay book={absBook} sessions={sessions} />` instead of the inline duration.
  `useAbsBooks()` hides hidden books by default. If a hidden book's sessions should still show
  the tooltip, call `useAbsBooks({ showHidden: true })` here, which matches how the calendar
  shows sessions regardless of hidden state.

#### 4e. Optional: audiobook progress ring

`AbsStatsCard` in `abs-book-page.tsx` shows a percentage only
(`book.completed ? 100 : book.progress * 100`). To match the ebook ring, add a line under it
when `reference_pages` is set:

```tsx
{book.reference_pages ? `≈ ${Math.round(book.progress * book.reference_pages)} / ${book.reference_pages} pages` : null}
```

using `book.reference_pages` when `book.completed`. This is just a label. The progress number
itself still comes from Audiobookshelf.

#### Verify the audiobook side

- Pick an audiobook, set **Reference pages** (and optionally **Playback speed**) under Manage.
- Audiobook page → Calendar: hover a day. It shows `≈ Pages a - b (n pages, estimated)`, and the
  timeline still renders.
- Audiobook with no reference pages: plain duration, no tooltip, no errors.
- Calendar page, **Audiobooks** and **Both**: listening rows have the tooltip, ebook rows have
  theirs.
- If you replaced the six formulas in 4b: day, week, month and year stats show the same page
  totals as before. Compare against `master` for one week before merging.

### Commit plan

1. `cherry-pick b666ea0` (with conflict resolution) and `cherry-pick d59690f`
2. "Loosen CalendarBookDay prop type, guard empty ranges, fix completed-book page label"
3. "Show estimated pages listened on audiobook calendars" (4a-4d)
4. Optional: "Share audiobook page estimate across stats pages" (4b refactor) and 4e

Merge `upstream-picks` into `master` after running `npm run build`, the server tests and a
`docker build`.
