<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/heading.png">
    <img src="images/heading-dark.png" width="80%">
  </picture>
</p>

<p align="center">
  <strong>KoInsight</strong> brings your <a href="https://koreader.rocks" target="_blank">KOReader</a> reading stats and <a href="https://audiobookshelf.org" target="_blank">AudioBookShelf</a> listening stats to life with a clean, web-based dashboard.
</p>

<p align="center">
   <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/screenshots/stats_1_d.png">
    <img src="images/screenshots/stats_1_l.png" width="100%">
  </picture>
</p>

# Features

- 📈 Interactive dashboard with charts and insights
- ✏️ Highlights sync
- ☁️ WebDAV sync — pull your KOReader `statistics.sqlite` directly from a WebDAV server
- 🎧 AudioBookShelf integration — view audiobook listening stats alongside e-book stats
- 🔀 Per-page data source toggle — switch between E-books, Audiobooks, or Both on Books, Calendar, and Stats pages
- 📤 Manual `.sqlite` upload supported
- 📱 Multi-device support
- ♻️ Act as a KOReader (kosync) sync server
- 🏠 Fully self-hostable (Docker image available)

# Screenshots
<p><strong>Note:</strong> Covers are not automatically displayed, as they are not part of the KOReader-generated database. You can add them once per book via the Cover Selector tab on each book page.</p>

<table>
  <tr>
    <td><strong>Home page</strong></td>
    <td><strong>Book view</strong></td>
  </tr>
  <tr>
    <td><img src="images/screenshots/book_ld.png" width="300"/></td>
    <td><img src="images/screenshots/home_ld.png" width="300"/></td>
  </tr>
  <tr>
    <td><strong>Statistics</strong></td>
    <td><strong>Statistics</strong></td>
  </tr>
  <tr>
    <td><img src="images/screenshots/stats_1_ld.png" width="300"/></td>
    <td><img src="images/screenshots/stats_2_ld.png" width="300"/></td>
  </tr>
</table>

See all [screenshots](/images/screenshots/)


# Installation
Using [Docker](https://docker.com) and [Docker Compose](https://docs.docker.com/compose/)

Add the following to your `compose.yaml` file:

```yaml
name: koinsight
services:
  koinsight:
    image: ghcr.io/georgesg/koinsight:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```
Run `docker compose up -d`.

# Configuration
KoInsight can be configured using the following environment variables:

- `HOSTNAME`: The hostname or IP address where the server will listen.<br>
  *Default:* `localhost`
- `PORT`: The port number for the web server.<br>
  *Default:* `3000`
- `MAX_FILE_SIZE_MB`: Maximum allowed size (in megabytes) for uploaded files.<br>
  *Default:* `100`
- `DATA_PATH`: Path to the directory where KoInsight data (such as stats or uploads) will be stored.<br>
  *Default:* `../../../data` or `/app/data` in Docker.

# Usage

## Getting reading statistics into KoInsight

There are two ways to load your KOReader statistics:

### Option 1 — WebDAV sync (recommended)

If your KOReader device syncs its data to a WebDAV server (e.g. Nextcloud, a NAS), KoInsight can pull the `statistics.sqlite` file directly.

1. Open **Settings** in the KoInsight sidebar.
2. Under **WebDAV Sync**, enter:
   - **WebDAV URL** — the base URL of your WebDAV server (e.g. `https://nextcloud.example.com/remote.php/dav/files/username`)
   - **Username** and **Password**
   - **Database file path** — the path to `statistics.sqlite` on the WebDAV server (e.g. `/KOReader/statistics.sqlite3`)
3. Click **Save settings**.
4. Click the **sync button** (↻) in the sidebar footer, between "Upload Statistics DB" and the light/dark mode toggle, to trigger an immediate sync.

KoInsight downloads the file and imports it in the same way as a manual upload.

### Option 2 — Manual upload

1. Open a file manager on your KOReader device.
2. Navigate to the `KOReader/settings/` folder.
3. Locate the `statistics.sqlite` file.
4. Copy it to your computer.
5. Click **Upload Statistics DB** in the KoInsight sidebar and select the file.

## AudioBookShelf integration

KoInsight can pull listening stats directly from your [AudioBookShelf](https://audiobookshelf.org) server.

1. Open **Settings** in the KoInsight sidebar.
2. Under **AudioBookShelf**, enter:
   - **Server URL** — the base URL of your AudioBookShelf instance (e.g. `https://abs.example.com`)
   - **API Key** — found in AudioBookShelf under **Settings → Users → your user → API Token**
3. Click **Save settings**.

AudioBookShelf data is fetched live from your server whenever a page loads. Use the sync button (↻) in the sidebar to force a refresh alongside a WebDAV sync.

## Data source toggle

The **Books**, **Calendar**, and **Reading stats** pages each have a toggle in the page header:

| Option | Shows |
|--------|-------|
| **E-books** | KOReader statistics only |
| **Both** | KOReader and AudioBookShelf data combined |
| **Audiobooks** | AudioBookShelf data only |

The toggle state is remembered per page in your browser.

## Sync button

The **↻** button in the sidebar footer (between "Upload Statistics DB" and the light/dark toggle) triggers:
1. A WebDAV sync — downloads the latest `statistics.sqlite` from your WebDAV server and imports it.
2. A full refresh of all AudioBookShelf data.

If WebDAV is not configured, only the AudioBookShelf refresh occurs (and vice versa).

## Use as a KOReader progress sync server

KoInsight implements the KoSync protocol, so you can use it as a reading-progress sync server across multiple KOReader devices.

1. Open the KOReader app.
2. Go to the **Tools** menu and open **Progress sync**.
3. Set the server URL to your KoInsight instance (e.g. `http://server-ip:3000`).
4. Register an account and log in.
5. Sync your progress.

# Development
See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and instructions.
