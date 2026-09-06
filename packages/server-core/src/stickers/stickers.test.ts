import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getSticker, isStickerPlacement } from '@webpod/stickers'
import { openStickerDatabase } from './database.ts'
import { createStickerRepository } from './repository.ts'
import { createAppleStickerClient } from './apple-import.ts'
import { classifyGenre } from './policy.ts'
import { handleStickerRequest, parseListeningObservation, readStickerBody, type StickerHttpServices } from './http.ts'
import { StickerError } from './repository.ts'
import { createStickerRuntime, stickerOperation } from './service.ts'
import { eq } from 'drizzle-orm'
import { tracks } from './schema.ts'

function fixture() {
  let time = 1_000_000
  const handle = openStickerDatabase(':memory:'); const repository = createStickerRepository(handle.db, () => time)
  repository.ensureOwner('a'); repository.ensureOwner('b')
  return { ...handle, repository, advance: (amount: number) => { time += amount }, observation: (sequence: number, positionMs: number, streamId = 's') => ({ eventId: `${streamId}-${String(sequence)}`, streamId, sequence, catalogId: '123', positionMs, playing: true }) }
}

describe('sticker ownership, persistence and earning ledger', () => {
  test('B1 enrichment before library import preserves membership through partial/complete retries', () => {
    const f = fixture()
    try {
      const track = { catalogId: '123', genre: 'rock' as const, durationMs: 300_000 }
      f.repository.enrichTrack('a', track)
      const partial = f.repository.importTracks('a', [track], 'partial')
      expect(partial.packs).toHaveLength(1)
      expect(partial.packs[0]?.stickerIds).toEqual(['PW-C01'])
      expect(f.repository.importTracks('a', [track], 'complete').packs).toHaveLength(1)
      expect(f.repository.importTracks('a', [track], 'complete').importStatus).toBe('complete')
      expect(f.db.select().from(tracks).where(eq(tracks.owner, 'a')).get()?.source).toBe('library')
    } finally { f.close() }
  })
  test('B2 late starter excludes already-owned first art and consumes all-owned eligibility without empty packs', () => {
    const f = fixture()
    try {
      f.repository.enrichTrack('a', { catalogId: '123', genre: 'rock', durationMs: 3_600_000 })
      f.repository.observe('a', f.observation(0, 0))
      for (let sequence = 1; sequence <= 30; sequence++) { f.advance(10_000); f.repository.observe('a', f.observation(sequence, sequence * 10_000)) }
      const library = [{ catalogId: '456', genre: 'rock' as const, durationMs: 300_000 }]
      const first = f.repository.importTracks('a', library, 'complete')
      expect(first.packs).toHaveLength(1)
      expect(first.packs[0]?.source).toBe('listening')
      expect(first.stickerIds).toEqual(['PW-C01'])
      expect(f.repository.importTracks('a', library, 'complete').packs).toHaveLength(1)
      // A later changed taste cannot reopen the consumed starter evaluation.
      expect(f.repository.importTracks('a', [{ catalogId: '789', genre: 'jazz', durationMs: 300_000 }], 'complete').packs).toHaveLength(1)
    } finally { f.close() }
  })
  test('B2 mixed late starter gives only unowned eligible first art', () => {
    const f = fixture()
    try {
      f.repository.enrichTrack('a', { catalogId: '123', genre: 'rock', durationMs: 3_600_000 })
      f.repository.observe('a', f.observation(0, 0))
      for (let sequence = 1; sequence <= 30; sequence++) { f.advance(10_000); f.repository.observe('a', f.observation(sequence, sequence * 10_000)) }
      const library = [{ catalogId: '456', genre: 'rock' as const, durationMs: 300_000 }, { catalogId: '789', genre: 'pop' as const, durationMs: 300_000 }]
      const result = f.repository.importTracks('a', library, 'partial')
      expect(result.packs.find((pack) => pack.source === 'starter')?.stickerIds).toEqual(['PW-B01'])
      expect(f.repository.importTracks('a', library, 'complete').packs).toHaveLength(2)
      expect(new Set(result.packs.flatMap((pack) => pack.stickerIds)).size).toBe(result.packs.flatMap((pack) => pack.stickerIds).length)
    } finally { f.close() }
  })
  test('B3 null import can resolve, resolved metadata survives weaker snapshots, checked unknown does not loop', () => {
    const f = fixture()
    try {
      const weak = { catalogId: '123', genre: null, durationMs: 300_000 }
      f.repository.importTracks('a', [weak], 'complete')
      expect(f.repository.needsEnrichment('a', '123')).toBe(true)
      f.repository.enrichTrack('a', { ...weak, genre: 'rock', durationMs: 400_000 })
      expect(f.repository.needsEnrichment('a', '123')).toBe(false)
      f.repository.importTracks('a', [weak], 'partial')
      const merged = f.db.select().from(tracks).where(eq(tracks.owner, 'a')).get()
      expect(merged?.genre).toBe('rock'); expect(merged?.durationMs).toBe(400_000); expect(merged?.source).toBe('library')
      f.repository.observe('a', f.observation(0, 0)); f.advance(10_000); const observed = f.repository.observe('a', f.observation(1, 10_000))
      expect(observed.progress.find((row) => row.genre === 'rock')?.listenedMs).toBe(10_000)
      f.repository.importTracks('b', [weak], 'complete')
      f.repository.enrichTrack('b', weak)
      expect(f.repository.needsEnrichment('b', '123')).toBe(false)
      f.repository.importTracks('b', [weak], 'complete')
      expect(f.repository.needsEnrichment('b', '123')).toBe(false)
      expect(f.repository.inventory('b').packs).toHaveLength(0)
    } finally { f.close() }
  })
  test('starter deduplicates and import membership earns no time; owner isolation', () => {
    const f = fixture()
    try {
      const input = [{ catalogId: '123', genre: 'metal' as const, durationMs: 300_000 }]
      const first = f.repository.importTracks('a', input, 'complete')
      f.repository.importTracks('a', input, 'complete')
      expect(f.repository.inventory('a').packs).toHaveLength(1)
      expect(first.progress.every((row) => row.listenedMs === 0)).toBe(true)
      expect(f.repository.inventory('b').packs).toHaveLength(0)
      expect(() => f.repository.openPack('b', first.packs[0]?.id ?? '')).toThrow()
      expect(() => f.repository.inventory('unknown')).toThrow()
    } finally { f.close() }
  })
  test('sequential observations credit server elapsed, retries do not, two tabs cannot double time', () => {
    const f = fixture()
    try {
      f.repository.importTracks('a', [{ catalogId: '123', genre: 'rock', durationMs: 300_000 }], 'complete')
      f.repository.observe('a', f.observation(0, 0)); f.repository.observe('a', f.observation(0, 0, 'tab2'))
      f.advance(10_000); f.repository.observe('a', f.observation(1, 10_000))
      f.repository.observe('a', f.observation(1, 10_000)); f.repository.observe('a', f.observation(1, 10_000, 'tab2'))
      expect(f.repository.inventory('a').progress.find((row) => row.genre === 'rock')?.listenedMs).toBe(10_000)
      f.advance(10_000); f.repository.observe('a', f.observation(2, 200_000)) // seek
      f.advance(40_000); f.repository.observe('a', f.observation(3, 240_000)) // stale gap
      f.advance(10_000); f.repository.observe('a', { ...f.observation(4, 250_000), playing: false })
      expect(f.repository.inventory('a').progress.find((row) => row.genre === 'rock')?.listenedMs).toBe(10_000)
      expect(() => f.repository.observe('a', { ...f.observation(2, 20_000), eventId: 'other-id' })).toThrow()
    } finally { f.close() }
  })
  test('5 minute new genre grant is exactly once and opens idempotently', () => {
    const f = fixture()
    try {
      f.repository.enrichTrack('a', { catalogId: '123', genre: 'jazz', durationMs: 3_600_000 })
      f.repository.observe('a', f.observation(0, 0))
      for (let sequence = 1; sequence < 30; sequence++) { f.advance(10_000); f.repository.observe('a', f.observation(sequence, sequence * 10_000)) }
      expect(f.repository.inventory('a').packs).toHaveLength(0)
      f.advance(10_000); const earned = f.repository.observe('a', f.observation(30, 300_000))
      expect(earned.packs).toHaveLength(1)
      f.repository.observe('a', f.observation(30, 300_000))
      const pack = earned.packs[0]; if (pack === undefined) throw new Error('missing pack')
      const opened = f.repository.openPack('a', pack.id); f.advance(2_000)
      expect(f.repository.openPack('a', pack.id).packs[0]?.openedAt).toBe(opened.packs[0]?.openedAt)
    } finally { f.close() }
  })
  test('placement validates rotated bounds, owned identity and stale revision', () => {
    const f = fixture()
    try {
      const owned = f.repository.importTracks('a', [{ catalogId: '123', genre: 'metal', durationMs: 300_000 }], 'complete').stickerIds[0]
      if (owned === undefined) throw new Error('missing sticker')
      const placement = { stickerId: owned, surface: 'back' as const, x: 0.5, y: 0.5, width: 0.25, rotationDeg: 35 }
      expect(isStickerPlacement(placement)).toBe(true)
      expect(isStickerPlacement({ ...placement, x: 0.08 })).toBe(false)
      expect(isStickerPlacement({ ...placement, width: NaN })).toBe(false)
      expect(f.repository.place('a', 0, [placement]).placementRevision).toBe(1)
      expect(() => f.repository.place('a', 0, [placement])).toThrow()
      expect(() => f.repository.place('b', 0, [placement])).toThrow()
      expect(getSticker(owned)).toBeDefined()
    } finally { f.close() }
  })
  test('new database migration repeats and inventory persists across reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'webpod-stickers-')); const path = join(directory, 'test.sqlite')
    try {
      const first = openStickerDatabase(path); const repository = createStickerRepository(first.db)
      repository.ensureOwner('a'); repository.importTracks('a', [{ catalogId: '123', genre: 'pop', durationMs: 1_000 }], 'complete'); first.close()
      const second = openStickerDatabase(path)
      try { expect(createStickerRepository(second.db).inventory('a').packs).toHaveLength(1) } finally { second.close() }
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
  test('v1 upgrades preserve collection/grants and reject unknown future schemas', () => {
    const directory = mkdtempSync(join(tmpdir(), 'webpod-sticker-upgrade-')); const path = join(directory, 'test.sqlite')
    try {
      const first = openStickerDatabase(path); const repository = createStickerRepository(first.db)
      repository.ensureOwner('a'); repository.enrichTrack('a', { catalogId: '123', genre: null, durationMs: 300_000 })
      repository.importTracks('a', [{ catalogId: '456', genre: 'pop', durationMs: 300_000 }], 'complete')
      // Reconstruct the published neutral v1 column set in this isolated fixture.
      first.db.$client.exec('ALTER TABLE sticker_collections DROP COLUMN appearances; ALTER TABLE sticker_collections DROP COLUMN starter_evaluated; ALTER TABLE sticker_tracks DROP COLUMN catalog_checked; DROP TABLE sticker_sessions; DROP TABLE sticker_devices; DELETE FROM sticker_schema WHERE version>1;')
      first.close()
      const upgraded = openStickerDatabase(path)
      try {
        const repo = createStickerRepository(upgraded.db)
        expect(repo.inventory('a').packs).toHaveLength(1)
        expect(repo.needsEnrichment('a', '123')).toBe(false)
        expect(repo.importTracks('a', [{ catalogId: '789', genre: 'rock', durationMs: 300_000 }], 'complete').packs).toHaveLength(1)
        upgraded.db.$client.exec('INSERT INTO sticker_schema(version) VALUES(999)')
      } finally { upgraded.close() }
      expect(() => openStickerDatabase(path)).toThrow('newer')
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})

describe('bounded Apple metadata ingestion', () => {
  test('canonical IDs, exact genre aliases, pagination and duplicate rows', async () => {
    const paths: string[] = []
    const fetcher = (async (input: RequestInfo | URL) => {
      paths.push(String(input))
      return Response.json({ data: [{ id: 'i.library', attributes: { playParams: { catalogId: '123' }, durationInMillis: 10_000, genreNames: ['Music', 'Hip-Hop/Rap'] } }], ...(paths.length === 1 ? { next: '/v1/me/library/songs?offset=100&limit=100' } : {}) })
    }) as typeof fetch
    const result = await createAppleStickerClient({ developerToken: 'synthetic-test', musicUserToken: 'synthetic-test', fetch: fetcher }).importLibrary()
    expect(result.tracks).toEqual([{ catalogId: '123', durationMs: 10_000, genre: 'hip-hop' }]); expect(result.status).toBe('complete')
    expect(classifyGenre(['Unknown'])).toBeNull()
    expect(classifyGenre(['constructor'])).toBeNull()
    expect(classifyGenre(['__proto__', 'toString', 'hasOwnProperty'])).toBeNull()
  })
  test('later-page rate limit rejects the entire snapshot; previously persisted taste and credits survive', async () => {
    const f = fixture(); let calls = 0
    const fetcher = (async () => {
      calls++
      return calls === 1 ? Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 300_000, genreNames: ['Rock'] } }], next: '/v1/me/library/songs?offset=100' }) : new Response('upstream private detail', { status: 429 })
    }) as unknown as typeof fetch
    try {
      f.repository.importTracks('a', [{ catalogId: '123', genre: 'pop', durationMs: 300_000 }], 'complete')
      await expect(createAppleStickerClient({ developerToken: 'synthetic-test', musicUserToken: 'synthetic-test', fetch: fetcher }).importLibrary()).rejects.toThrow('temporarily unavailable')
      f.repository.markImportFailed('a')
      expect(f.repository.inventory('a').importStatus).toBe('failed')
      expect(f.repository.inventory('a').stickerIds).toEqual(['PW-B01'])
      expect(f.repository.inventory('a').progress.every((row) => row.listenedMs === 0)).toBe(true)
      expect(f.db.select().from(tracks).where(eq(tracks.owner, 'a')).get()?.genre).toBe('pop')
    } finally { f.close() }
  })
  test('repeated next paths, malformed pages and oversized responses reject without false completion', async () => {
    for (const response of [() => Response.json({ data: [], next: '/v1/me/library/songs?limit=100' }), () => Response.json({ data: 'invalid' }), () => new Response('x'.repeat(2_000_001))]) {
      const fetcher = (async () => response()) as unknown as typeof fetch
      await expect(createAppleStickerClient({ developerToken: 'synthetic-test', musicUserToken: 'synthetic-test', fetch: fetcher }).importLibrary()).rejects.toThrow()
    }
  })
  test('page ceiling returns explicit partial snapshot', async () => {
    let calls = 0
    const fetcher = (async () => { calls++; return Response.json({ data: [], next: `/v1/me/library/songs?offset=${String(calls * 100)}` }) }) as unknown as typeof fetch
    expect((await createAppleStickerClient({ developerToken: 'synthetic-test', musicUserToken: 'synthetic-test', fetch: fetcher }).importLibrary()).status).toBe('partial')
    expect(calls).toBe(25)
  })
  test('upstream pagination cannot redirect credential-bearing requests and failure is safe', async () => {
    let calls = 0
    const fetcher = (async () => { calls++; return Response.json({ data: [], next: 'https://attacker.invalid/me' }) }) as unknown as typeof fetch
    await expect(createAppleStickerClient({ developerToken: 'synthetic-test', musicUserToken: 'synthetic-test', fetch: fetcher }).importLibrary()).rejects.toThrow('pagination')
    expect(calls).toBe(1)
  })
})

describe('HTTP validation and Effect runtime', () => {
  test('B3 HTTP enriches missing genre once and accepts authoritative unknown without network loop', async () => {
    const f = fixture(); let enrichments = 0
    f.repository.importTracks('a', [{ catalogId: '123', genre: null, durationMs: 300_000 }], 'complete')
    const services: StickerHttpServices = {
      prepare: async () => [], authorized: async (_request, operation) => operation(f.repository, 'a'),
      resolveOwner: async () => 'a', run: async (operation) => operation(f.repository),
      bootstrap: async () => ({ inventory: f.repository.inventory('a'), cookies: [] }), logout: async () => [],
      enrich: async (owner, catalogId) => { enrichments++; f.repository.enrichTrack(owner, { catalogId, genre: null, durationMs: 300_000 }) },
    }
    try {
      for (let sequence = 0; sequence < 3; sequence++) {
        f.advance(10_000)
        const request = new Request('https://webpod.test/api/stickers/listening', { method: 'POST', headers: { origin: 'https://webpod.test', 'content-type': 'application/json' }, body: JSON.stringify(f.observation(sequence, sequence * 10_000)) })
        expect((await handleStickerRequest(request, services)).status).toBe(200)
      }
      expect(enrichments).toBe(1)
      expect(f.repository.inventory('a').progress.every((row) => row.listenedMs === 0)).toBe(true)
    } finally { f.close() }
  })
  test('Effect runtime scopes storage and executes real repository operations', async () => {
    const runtime = createStickerRuntime(':memory:')
    try {
      await runtime.runPromise(stickerOperation((repository) => repository.ensureOwner('a')))
      expect((await runtime.runPromise(stickerOperation((repository) => repository.inventory('a')))).packs).toHaveLength(0)
    } finally { await runtime.dispose() }
  })
  test('oversized and invalid observations are rejected before domain work', async () => {
    await expect(readStickerBody(new Request('https://webpod.test/api/stickers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ large: 'x'.repeat(40_000) }) }))).rejects.toThrow('too large')
    expect(() => parseListeningObservation({ eventId: 'a', streamId: 's', sequence: 0, catalogId: '123', positionMs: NaN, playing: true })).toThrow()
  })
  test('cross-origin bootstrap and unauthenticated reads never expose repository data', async () => {
    const f = fixture(); let bootstraps = 0
    const services: StickerHttpServices = {
      prepare: async () => [], authorized: async (_request, operation) => operation(f.repository, 'a'),
      resolveOwner: async () => { throw new StickerError('unauthorized', 401, 'Sign in.') },
      run: async (operation) => operation(f.repository),
      bootstrap: async () => { bootstraps++; return { inventory: f.repository.inventory('a'), cookies: [] } },
      enrich: async () => undefined, logout: async () => [],
    }
    try {
      const cross = await handleStickerRequest(new Request('https://webpod.test/api/stickers/session', { method: 'POST', headers: { origin: 'https://other.test', 'content-type': 'application/json' }, body: '{"musicUserToken":"synthetic-test"}' }), services)
      expect(cross.status).toBe(403); expect(bootstraps).toBe(0)
      const unauthenticated = await handleStickerRequest(new Request('https://webpod.test/api/stickers'), services)
      expect(unauthenticated.status).toBe(401); expect(unauthenticated.headers.get('cache-control')).toBe('no-store')
    } finally { f.close() }
  })
})

describe('durable owned sticker appearance', () => {
  test('wear and geometry share ownership/revision transaction; return retains wear and omission preserves it', () => {
    const f = fixture()
    try {
      f.repository.importTracks('a', [{ catalogId: '123', genre: 'rock', durationMs: 300000 }], 'complete')
      const original = { stickerId: 'PW-C01' as const, surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 }
      const saved = f.repository.place('a', 0, [{ ...original, wear: .7 }])
      expect(saved.appearances).toEqual([{ stickerId: original.stickerId, wear: .7 }])
      expect(saved.placements[0]?.wear).toBe(.7)
      expect(f.db.$client.query<{ placements: string }, []>('SELECT placements FROM sticker_collections WHERE owner=\'a\'').get()?.placements).not.toContain('wear')
      expect(() => f.repository.place('a', 0, [{ ...original, wear: .2 }])).toThrow('changed')
      expect(() => f.repository.place('b', 0, [{ ...original, wear: .2 }])).toThrow('owned')
      expect(f.repository.inventory('a').appearances).toEqual(saved.appearances)
      const returned = f.repository.place('a', 1, [])
      expect(returned.placements).toEqual([]); expect(returned.appearances).toEqual(saved.appearances)
      expect(f.repository.place('a', 2, [original]).placements[0]?.wear).toBe(.7)
      const reset = f.repository.place('a', 3, [{ ...original, wear: 0 }])
      expect(reset.placementRevision).toBe(4); expect(reset.placements[0]?.wear).toBe(0)
      f.db.$client.query('UPDATE sticker_collections SET placements=? WHERE owner=?').run(JSON.stringify([{ ...original, wear: .99 }]), 'a')
      expect(f.repository.inventory('a').placements[0]?.wear).toBe(0)
      for (const wear of [-.01, 1.01, NaN, Infinity, null, '0.5']) expect(isStickerPlacement({ ...original, wear })).toBe(false)
      expect(isStickerPlacement(original)).toBe(true)
      expect(isStickerPlacement({ ...original, wear: 1 })).toBe(true)
    } finally { f.close() }
  })
  for (const version of [2, 3]) test(`populated v${version} upgrades to v4 and wear persists across reopen`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'webpod-wear-migration-')); const path = join(directory, 'test.sqlite')
    try {
      const first = openStickerDatabase(path); const initial = createStickerRepository(first.db)
      initial.ensureOwner('a'); initial.importTracks('a', [{ catalogId: '123', genre: 'rock', durationMs: 300000 }], 'complete')
      const original = { stickerId: 'PW-C01' as const, surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 15 }
      initial.place('a', 0, [original]); const prior = initial.inventory('a')
      first.db.$client.exec('ALTER TABLE sticker_collections DROP COLUMN appearances; DELETE FROM sticker_schema WHERE version=4;')
      if (version === 2) first.db.$client.exec('DROP TABLE sticker_sessions; DROP TABLE sticker_devices; DELETE FROM sticker_schema WHERE version=3;')
      first.close()
      const upgraded = openStickerDatabase(path); const repository = createStickerRepository(upgraded.db)
      expect(repository.inventory('a')).toEqual(prior)
      repository.place('a', 1, [{ ...original, wear: .65 }]); repository.place('a', 2, []); upgraded.close()
      const reopened = openStickerDatabase(path)
      try {
        const repo = createStickerRepository(reopened.db)
        expect(repo.inventory('a').placements).toEqual([])
        expect(repo.place('a', 3, [original]).placements[0]?.wear).toBe(.65)
        expect(repo.inventory('a').packs).toEqual(prior.packs)
      } finally { reopened.close() }
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})
