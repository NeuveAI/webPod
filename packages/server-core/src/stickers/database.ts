import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema.ts'

/** Reviewed additive v1 schema. Called only by explicit factory; no import-time database I/O. */
const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS sticker_schema (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS sticker_collections (owner TEXT PRIMARY KEY, created_at INTEGER NOT NULL, import_status TEXT NOT NULL DEFAULT 'pending', revision INTEGER NOT NULL DEFAULT 0, placements TEXT NOT NULL DEFAULT '[]', last_credit_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sticker_tracks (owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE, catalog_id TEXT NOT NULL, genre TEXT, duration_ms INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY(owner,catalog_id));
CREATE TABLE IF NOT EXISTS sticker_credits (owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE, genre TEXT NOT NULL, listened_ms INTEGER NOT NULL, PRIMARY KEY(owner,genre));
CREATE TABLE IF NOT EXISTS sticker_packs (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE, grant_key TEXT NOT NULL, source TEXT NOT NULL, sticker_ids TEXT NOT NULL, earned_at INTEGER NOT NULL, opened_at INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS sticker_grant_unique ON sticker_packs(owner,grant_key);
CREATE TABLE IF NOT EXISTS sticker_observations (owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE, event_id TEXT NOT NULL, stream_id TEXT NOT NULL, sequence INTEGER NOT NULL, catalog_id TEXT NOT NULL, position_ms INTEGER NOT NULL, playing INTEGER NOT NULL, received_at INTEGER NOT NULL, credited_ms INTEGER NOT NULL, PRIMARY KEY(owner,event_id));
CREATE UNIQUE INDEX IF NOT EXISTS sticker_stream_sequence ON sticker_observations(owner,stream_id,sequence);
CREATE INDEX IF NOT EXISTS sticker_stream_latest ON sticker_observations(owner,stream_id,received_at);
INSERT OR IGNORE INTO sticker_schema(version) VALUES (1);
`

/** Owns a single Bun SQLite handle. Caller must close it on runtime disposal. */
export function openStickerDatabase(path: string) {
  const client = new Database(path, { strict: true, create: true })
  try {
    // Refuse a future schema before changing persistent journal settings or schema state.
    const hasSchema = client.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='sticker_schema'").get()
    if (hasSchema !== null) {
      const current = client.query<{ version: number | null }, []>('SELECT MAX(version) AS version FROM sticker_schema').get()
      if ((current?.version ?? 0) > 3) throw new Error('Sticker database schema is newer than this runtime')
    }
    client.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;')
    client.transaction(() => {
      client.exec('CREATE TABLE IF NOT EXISTS sticker_schema (version INTEGER PRIMARY KEY)')
      const row = client.query<{ version: number | null }, []>('SELECT MAX(version) AS version FROM sticker_schema').get()
      const version = row?.version ?? 0
      if (version > 3) throw new Error('Sticker database schema is newer than this runtime')
      client.exec(MIGRATION_V1)
      if (version < 2) {
        client.exec(`ALTER TABLE sticker_collections ADD COLUMN starter_evaluated INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE sticker_tracks ADD COLUMN catalog_checked INTEGER NOT NULL DEFAULT 0;
          UPDATE sticker_tracks SET catalog_checked=1 WHERE source='catalog';
          UPDATE sticker_collections SET starter_evaluated=1 WHERE owner IN (SELECT owner FROM sticker_packs WHERE grant_key='starter:v1');
          INSERT INTO sticker_schema(version) VALUES (2);`)
      }
      if (version < 3) client.exec(`
        CREATE TABLE sticker_devices (secret_hash TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, generation INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL, last_bootstrap_at INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE sticker_sessions (secret_hash TEXT PRIMARY KEY, device_hash TEXT NOT NULL REFERENCES sticker_devices(secret_hash) ON DELETE CASCADE, generation INTEGER NOT NULL, storefront TEXT NOT NULL, expires_at INTEGER NOT NULL);
        CREATE INDEX sticker_session_device ON sticker_sessions(device_hash);
        CREATE INDEX sticker_session_expiry ON sticker_sessions(expires_at);
        INSERT INTO sticker_schema(version) VALUES (3);
      `)
    })()
    return { db: drizzle(client, { schema }), close: () => client.close() }
  } catch (cause) { client.close(); throw cause }
}
export type StickerDatabase = ReturnType<typeof openStickerDatabase>['db']
