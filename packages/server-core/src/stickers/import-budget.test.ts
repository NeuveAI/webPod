import { expect, spyOn, test } from 'bun:test'
import { createAppleStickerClient, type AppleImportDiagnostic } from './apple-import'
import { openStickerDatabase } from './database'
import { createStickerRepository } from './repository'
import { createLiveStickerServer } from './live'

const timeout = () => new DOMException('Synthetic budget expiry', 'TimeoutError')
const row = (id: number) => ({ id: `i.${id}`, attributes: { durationInMillis: 300_000 }, relationships: { catalog: { data: [{ type: 'songs', id: String(id), attributes: { genreNames: ['Rock'] } }] } } })
const page = (index: number) => ({ data: Array.from({ length: 100 }, (_, i) => row(index * 100 + i + 1)), next: `/v1/me/library/songs?offset=opaque%2B${index + 1}%3D` })
function deadlineFixture() {
  const budget = new AbortController(); const external = new AbortController(); const diagnostics: AppleImportDiagnostic[] = []
  const timer = spyOn(AbortSignal, 'timeout').mockReturnValue(budget.signal)
  return { budget, external, diagnostics, timer }
}

test('24 validated pages survive in-flight own deadline and generate starter in the first session', async () => {
  const f = deadlineFixture(); let calls = 0
  const service = createLiveStickerServer({ databasePath: ':memory:', developerToken: async () => 'synthetic', onImport: (event) => f.diagnostics.push(event), fetch: async (input) => {
    if (String(input).includes('storefront')) return Response.json({ data: [{ id: 'se' }] })
    if (calls === 24) { f.budget.abort(timeout()); throw f.budget.signal.reason }
    const index = calls++
    return Response.json({ ...page(index), data: Array.from({ length: 100 }, (_, i) => { const n = index * 100 + i; return n < 2026 ? row(n + 1) : n < 2369 ? { id: `i.upload-${n}` } : row(1) }) })
  } })
  try {
    const origin = 'http://local.invalid'
    const device = await service.handle(new Request(origin + '/api/stickers/device', { method: 'POST', headers: { origin } }))
    const cookie = device.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
    const result = await service.handle(new Request(origin + '/api/stickers/session', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ musicUserToken: 'synthetic' }) }))
    expect(result.status).toBe(200)
    const inventory = await result.json() as { importStatus: string; packs: { source: string }[]; stickerIds: string[] }
    expect(inventory.importStatus).toBe('partial'); expect(inventory.packs).toHaveLength(1); expect(inventory.packs[0]?.source).toBe('starter'); expect(inventory.stickerIds).toEqual(['PW-C01'])
    expect(f.diagnostics).toEqual([{ status: 'partial', reason: 'sample_time_limit', pages: 24, received: 2400, accepted: 2026, skipped: 343 }])
  } finally { await service.dispose(); f.timer.mockRestore() }
})

test('budget exhausted between validated pages stops before another request', async () => {
  const f = deadlineFixture(); let calls = 0
  try {
    const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (event) => f.diagnostics.push(event), fetch: async () => {
      calls++; const response = Response.json(page(0))
      // Deadline fires once bytes were read, while finishing this validated page.
      return new Response(new ReadableStream({ start(controller) { void response.arrayBuffer().then((bytes) => { controller.enqueue(new Uint8Array(bytes)); controller.close(); f.budget.abort(timeout()) }) } }))
    } })
    const result = await client.importLibrary()
    expect(result.status).toBe('partial'); expect(result.tracks).toHaveLength(100); expect(calls).toBe(1); expect(f.diagnostics[0]?.reason).toBe('sample_time_limit')
  } finally { f.timer.mockRestore() }
})

test('no complete usable page remains failure, including a deadline during first streamed page', async () => {
  for (const emptyPrefix of [false, true]) {
    const f = deadlineFixture(); let calls = 0
    try {
      const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (event) => f.diagnostics.push(event), fetch: async () => {
        if (emptyPrefix && calls++ === 0) return Response.json({ data: [{ id: 'i.upload' }], next: '/v1/me/library/songs?offset=next' })
        return new Response(new ReadableStream({ pull(controller) { f.budget.abort(timeout()); controller.error(f.budget.signal.reason) } }, { highWaterMark: 0 }))
      } })
      await expect(client.importLibrary()).rejects.toThrow(); expect(f.diagnostics[0]?.status).toBe('failed'); expect(f.diagnostics[0]?.accepted).toBe(0)
    } finally { f.timer.mockRestore() }
  }
})

test('malformed, auth and upstream failures win over simultaneous own deadline and cannot return prefix', async () => {
  for (const kind of ['json', 'pagination', '401', '429', '500', 'network'] as const) {
    const f = deadlineFixture(); let calls = 0
    try {
      const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (event) => f.diagnostics.push(event), fetch: async () => {
        if (calls++ === 0) return Response.json(page(0))
        f.budget.abort(timeout())
        if (kind === 'network') throw new Error('Synthetic independent network failure')
        if (kind === 'json') return new Response('invalid-json')
        if (kind === 'pagination') return Response.json({ data: [row(999)], next: '/v1/me/library/albums?offset=wrong' })
        return new Response(null, { status: Number(kind) })
      } })
      await expect(client.importLibrary()).rejects.toThrow(); expect(f.diagnostics[0]?.status).toBe('failed'); expect(f.diagnostics[0]?.pages).toBe(1); expect(f.diagnostics[0]?.accepted).toBe(100)
    } finally { f.timer.mockRestore() }
  }
})

test('external cancellation at the budget boundary rejects without modifying previous repository state', async () => {
  const f = deadlineFixture(); let calls = 0
  const database = openStickerDatabase(':memory:'); const repository = createStickerRepository(database.db)
  repository.ensureOwner('synthetic-owner'); const before = repository.inventory('synthetic-owner')
  try {
    const client = createAppleStickerClient({ developerToken: 'synthetic', signal: f.external.signal, onImport: (event) => f.diagnostics.push(event), fetch: async () => {
      if (calls++ === 0) return Response.json(page(0))
      f.budget.abort(timeout()); f.external.abort(new DOMException('Synthetic disconnect', 'AbortError')); throw f.budget.signal.reason
    } })
    await expect(client.importLibrary().then((sample) => repository.importTracks('synthetic-owner', sample.tracks, sample.status))).rejects.toThrow()
    expect(repository.inventory('synthetic-owner')).toEqual(before); expect(f.diagnostics[0]?.reason).toBe('cancelled')
  } finally { database.close(); f.timer.mockRestore() }
})

test('native Bun fetch body cancellation preserves own deadline identity after a validated page', async () => {
  const f = deadlineFixture(); let calls = 0
  const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => {
    if (calls++ === 0) return Response.json(page(0))
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"data":[')); setTimeout(() => f.budget.abort(timeout()), 10) } }))
  } })
  try {
    const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (event) => f.diagnostics.push(event), fetch: (_input, init) => fetch(upstream.url, init) })
    const result = await client.importLibrary()
    expect(result.status).toBe('partial'); expect(result.tracks).toHaveLength(100); expect(f.diagnostics[0]?.reason).toBe('sample_time_limit')
  } finally { await upstream.stop(true); f.timer.mockRestore() }
})
