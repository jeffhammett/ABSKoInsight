import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { removeSqliteFiles, removeStaleSyncFiles } from './sync-service';

describe('WebDAV sync temp file cleanup', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'koinsight-sync-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe(removeSqliteFiles, () => {
    it('removes the -wal and -shm files a read-only open of a WAL database leaves behind', () => {
      const dbPath = path.join(dir, 'webdav_sync_1.sqlite3');

      // Build a WAL-mode database like KOReader's statistics.sqlite3
      const writer = new Database(dbPath);
      writer.pragma('journal_mode = WAL');
      writer.exec('CREATE TABLE book (id INTEGER PRIMARY KEY)');
      writer.exec('INSERT INTO book (id) VALUES (1)');
      writer.close();

      const reader = new Database(dbPath, { readonly: true });
      reader.prepare('SELECT id FROM book').all();
      reader.close();

      // Reproduces the leak: deleting just the main file would leave these behind
      expect(readdirSync(dir).sort()).toEqual([
        'webdav_sync_1.sqlite3',
        'webdav_sync_1.sqlite3-shm',
        'webdav_sync_1.sqlite3-wal',
      ]);

      removeSqliteFiles(dbPath);
      expect(readdirSync(dir)).toEqual([]);
    });

    it('does not throw when files are missing', () => {
      expect(() => removeSqliteFiles(path.join(dir, 'missing.sqlite3'))).not.toThrow();
    });
  });

  describe(removeStaleSyncFiles, () => {
    const now = 2_000_000_000_000;
    const old = now - 60 * 60 * 1000;
    const recent = now - 60 * 1000;

    it('removes old sync temp files and keeps recent ones and unrelated files', () => {
      const files = [
        `webdav_sync_${old}.sqlite3`,
        `webdav_sync_${old}.sqlite3-wal`,
        `webdav_sync_${old}.sqlite3-shm`,
        `webdav_sync_${recent}.sqlite3`,
        `webdav_sync_${recent}.sqlite3-wal`,
        'prod.sqlite3',
        'prod.sqlite3-wal',
        'webdav_sync_notes.txt',
      ];
      for (const f of files) writeFileSync(path.join(dir, f), '');

      removeStaleSyncFiles(dir, now);

      expect(readdirSync(dir).sort()).toEqual(
        [
          `webdav_sync_${recent}.sqlite3`,
          `webdav_sync_${recent}.sqlite3-wal`,
          'prod.sqlite3',
          'prod.sqlite3-wal',
          'webdav_sync_notes.txt',
        ].sort()
      );
    });

    it('does nothing for a missing directory', () => {
      const missing = path.join(dir, 'nope');
      expect(() => removeStaleSyncFiles(missing, now)).not.toThrow();
      expect(existsSync(missing)).toBe(false);
    });
  });
});
