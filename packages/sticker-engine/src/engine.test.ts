import { expect, test } from 'bun:test'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { sql } from 'drizzle-orm'
import { createWasmDatabase, migrateBrowserDatabase } from './wasm.ts'
import { createStickerRepository } from './repository.ts'
import { exportBackup, importBackup } from './backup.ts'

const sqlite = await sqlite3InitModule()
function setup() { const client = new sqlite.oo1.DB(':memory:'); migrateBrowserDatabase(client); const db = createWasmDatabase(client); const repository = createStickerRepository(db); repository.ensureOwner('local'); return { client, db, repository } }
test('WASM adapter preserves transactions, starter grant, layout/wear and semantic backups', () => {
  const { client, db, repository } = setup()
  try {
    const earned = repository.importTracks('local', [{ catalogId: '123', genre: 'rock', durationMs: 300000 }], 'complete')
    expect(earned.stickerIds.length).toBe(1)
    const id = earned.stickerIds[0]; const pack = earned.packs[0]
    if (!id || !pack) throw new Error('Starter pack was not granted')
    repository.place('local', 0, [{ stickerId: id, surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0, wear: .6 }])
    repository.openPack('local', pack.id)
    const snapshot = repository.inventory('local'); const backup = exportBackup(db, 'local')
    repository.place('local', 1, [])
    const restored = importBackup(db, 'local', backup)
    expect(restored.placements).toEqual(snapshot.placements)
    expect(restored.appearances).toEqual(snapshot.appearances)
    expect(restored.packs).toEqual(snapshot.packs)
    expect(restored.progress).toEqual(snapshot.progress)
    expect(restored.placementRevision).toBe(3)
    expect(db.all(sql`select count(*) as count from sticker_tracks`)).toEqual([{ count: 1 }])
    const before = exportBackup(db, 'local')
    for (const poison of ['{}', backup.replace('"durationMs":300000', '"durationMs":0'), backup.replace('"catalogId":"123"', '"catalogId":"hostile"'), backup.replace('"revision":1', '"revision":9007199254740991')]) {
      expect(() => importBackup(db, 'local', poison)).toThrow()
      expect(exportBackup(db, 'local')).toBe(before)
    }
    client.exec("CREATE TEMP TRIGGER simulated_write_failure BEFORE INSERT ON sticker_tracks BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END")
    expect(() => importBackup(db, 'local', backup)).toThrow()
    expect(exportBackup(db, 'local')).toBe(before)
    client.exec('DROP TRIGGER simulated_write_failure')
    expect(() => repository.place('local', 1, [])).toThrow('changed')
  } finally { client.close() }
})
test('WASM listening accounting retains deduplication and threshold grants', () => {
  const { client, db, repository } = setup(); let now = 1000000
  const clocked = createStickerRepository(db, () => now)
  try {
    repository.enrichTrack('local', { catalogId: '456', genre: 'jazz', durationMs: 3600000 })
    for (let sequence = 0; sequence <= 20; sequence++) {
      const event = { eventId: `event-${sequence}`, streamId: 'stream', sequence, catalogId: '456', positionMs: sequence * 15000, playing: true }
      clocked.observe('local', event); clocked.observe('local', event); now += 15000
    }
    const inventory = clocked.inventory('local')
    expect(inventory.progress.find(p => p.genre === 'jazz')?.listenedMs).toBe(300000)
    expect(inventory.packs.length).toBe(1)
    expect(inventory.packs[0]?.source).toBe('listening')
  } finally { client.close() }
})
