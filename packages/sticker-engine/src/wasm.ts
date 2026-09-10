import { drizzle } from 'drizzle-orm/sql-js'
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import * as schema from './schema.ts'

/** The small SQL.js statement surface used by pinned Drizzle 0.45.2. Results are
 * materialized through OO1 exec, which finalizes handles even when SQL throws. */
export function createWasmDatabase(client: Database) {
  const adapter = {
    prepare(sql: string) {
      let rows: SqlValue[][] = []; let objects: Record<string, SqlValue>[] = []; let index = -1
      const bind = (params: SqlValue[] = []) => {
        const columnNames: string[] = []
        rows = client.exec({ sql, bind: params, columnNames, rowMode: 'array', returnValue: 'resultRows' })
        objects = rows.map(row => Object.fromEntries(columnNames.map((name, i) => [name, row[i] ?? null])))
        index = -1
      }
      return {
        bind,
        run(params: SqlValue[]) { client.exec({ sql, bind: params }) },
        step() { return ++index < rows.length },
        get(params?: SqlValue[]) { if (params !== undefined) { bind(params); index = 0 }; return rows[index] ?? [] },
        getAsObject(params?: SqlValue[]) {
          if (params !== undefined) { objects = client.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }); index = 0 }
          return objects[index]
        },
        free() { rows = []; objects = [] },
      }
    },
  }
  // Drizzle's driver types require the entire SQL.js Database; only prepare and
  // the statement methods above are exercised (verified against pinned source).
  return drizzle(adapter as unknown as Parameters<typeof drizzle>[0], { schema })
}

/** Browser database has no credentials, device records or session tables. */
export function migrateBrowserDatabase(client: Database) {
  const existing = client.selectValue("SELECT name FROM sqlite_master WHERE type='table' AND name='browser_sticker_schema'")
  if (existing && client.selectValue('SELECT max(version) FROM browser_sticker_schema') !== 1) throw new Error('This sticker database needs a newer webPod version.')
  client.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;')
  client.transaction(() => client.exec(`
    CREATE TABLE IF NOT EXISTS browser_sticker_schema(version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO browser_sticker_schema VALUES(1);
    CREATE TABLE IF NOT EXISTS sticker_collections(owner TEXT PRIMARY KEY,created_at INTEGER NOT NULL,import_status TEXT NOT NULL DEFAULT 'pending',revision INTEGER NOT NULL DEFAULT 0,placements TEXT NOT NULL DEFAULT '[]',appearances TEXT NOT NULL DEFAULT '[]',last_credit_at INTEGER NOT NULL DEFAULT 0,starter_evaluated INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sticker_tracks(owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE,catalog_id TEXT NOT NULL,genre TEXT,duration_ms INTEGER NOT NULL,source TEXT NOT NULL,catalog_checked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,catalog_id));
    CREATE TABLE IF NOT EXISTS sticker_credits(owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE,genre TEXT NOT NULL,listened_ms INTEGER NOT NULL,PRIMARY KEY(owner,genre));
    CREATE TABLE IF NOT EXISTS sticker_packs(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE,grant_key TEXT NOT NULL,source TEXT NOT NULL,sticker_ids TEXT NOT NULL,earned_at INTEGER NOT NULL,opened_at INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS sticker_grant_unique ON sticker_packs(owner,grant_key);
    CREATE TABLE IF NOT EXISTS sticker_observations(owner TEXT NOT NULL REFERENCES sticker_collections(owner) ON DELETE CASCADE,event_id TEXT NOT NULL,stream_id TEXT NOT NULL,sequence INTEGER NOT NULL,catalog_id TEXT NOT NULL,position_ms INTEGER NOT NULL,playing INTEGER NOT NULL,received_at INTEGER NOT NULL,credited_ms INTEGER NOT NULL,PRIMARY KEY(owner,event_id));
    CREATE UNIQUE INDEX IF NOT EXISTS sticker_stream_sequence ON sticker_observations(owner,stream_id,sequence);
    CREATE INDEX IF NOT EXISTS sticker_stream_latest ON sticker_observations(owner,stream_id,received_at);
  `))
}
