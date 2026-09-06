import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CookieMap } from 'bun'
import { createLiveStickerServer } from './live.ts'
import { openStickerDatabase } from './database.ts'
import { createStickerRepository } from './repository.ts'
import { SESSION_TTL_MS } from './sessions.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean() })
const library = { data: [{ id: 'library-id', attributes: { playParams: { catalogId: '123' }, durationInMillis: 300000, genreNames: ['Rock'] } }] }
function fixture(fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async (input, init) => {
  const path = new URL(String(input)).pathname
  if (path === '/v1/me/storefront') return Response.json({ data: [{ id: 'us' }] })
  if (path === '/v1/me/library/songs') return Response.json(library)
  expect(new Headers(init?.headers).has('music-user-token')).toBe(false)
  return Response.json({ data: [{ id: path.split('/').at(-1), attributes: { durationInMillis: 300000, genreNames: ['Rock'] } }] })
}) {
  const dir = mkdtempSync(join(tmpdir(), 'webpod-session-')); const path = join(dir, 'test.sqlite')
  let now = 100000
  let server = createLiveStickerServer({ databasePath: path, developerToken: async () => 'synthetic-developer', fetch: fetcher, now: () => now })
  cleanups.push(async () => { await server.dispose(); rmSync(dir, { recursive: true, force: true }) })
  function browser() {
    const jar = new CookieMap()
    return {
      jar,
      async request(endpoint = '', method = 'GET', body?: unknown) {
        const response = await server.handle(new Request(`https://webpod.test/api/stickers${endpoint}`, { method, headers: { origin: 'https://webpod.test', cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
        for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0] ?? ''; const index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)) }
        return response
      },
    }
  }
  return { browser, path, handle: (request: Request) => server.handle(request), dispose: () => server.dispose(), advance: (ms = 6000) => { now += ms }, async restart() { await server.dispose(); server = createLiveStickerServer({ databasePath: path, developerToken: async () => 'synthetic-developer', fetch: fetcher, now: () => now }) } }
}
describe('device collection sessions', () => {
  test('preparation alone cannot read; verified import survives logout, reconnect, rotation, restart and remains isolated', async () => {
    const f = fixture(); const a = f.browser(); const b = f.browser()
    expect((await a.request('/device', 'POST')).status).toBe(200)
    expect((await a.request()).status).toBe(401)
    const auth = await a.request('/session', 'POST', { musicUserToken: 'synthetic-user', owner: 'forged' })
    expect(auth.status).toBe(200); expect(auth.headers.get('cache-control')).toBe('no-store')
    expect(auth.headers.getSetCookie()[0]).toContain('HttpOnly')
    const inventory = await auth.json(); expect(inventory.stickerIds.length).toBeGreaterThan(0)
    const oldSession = (a.jar.get('webpod_session') ?? 'missing')
    expect((await a.request('/packs/open', 'POST', { packId: inventory.packs[0].id })).status).toBe(200)
    await a.request('/session', 'DELETE')
    a.jar.set('webpod_session', oldSession)
    expect((await a.request()).status).toBe(401)
    f.advance(); expect((await a.request('/session', 'POST', { musicUserToken: 'synthetic-user-2' })).status).toBe(200)
    await f.restart()
    const after = await (await a.request()).json()
    expect(after.stickerIds).toEqual(inventory.stickerIds); expect(after.packs[0].openedAt).not.toBeNull()
    await b.request('/device', 'POST'); expect((await b.request()).status).toBe(401)
    const second = await (await b.request('/session', 'POST', { musicUserToken: 'synthetic-other' })).json()
    expect(second.packs[0].id).not.toBe(inventory.packs[0].id)
    f.advance(SESSION_TTL_MS); expect((await a.request()).status).toBe(401)
    const db = openStickerDatabase(f.path)
    try {
      const rows = db.db.query.devices.findMany().sync()
      expect(rows.some((row) => row.owner === 'forged')).toBe(false)
      expect(rows.every((row) => row.secretHash.length === 64)).toBe(true)
    } finally { db.close() }
  })
  test('failed upstream authorization never grants a session or creates a collection', async () => {
    const f = fixture(async () => new Response(null, { status: 401 })); const a = f.browser()
    await a.request('/device', 'POST')
    expect((await a.request('/session', 'POST', { musicUserToken: 'synthetic' })).status).toBe(401)
    expect(a.jar.has('webpod_session')).toBe(false)
    const db = openStickerDatabase(f.path)
    try { expect(db.db.query.collections.findMany().sync()).toHaveLength(0) } finally { db.close() }
  })
  test('logout while upstream import is suspended prevents activation and grants', async () => {
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve })
    let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve })
    const f = fixture(async (input) => {
      if (String(input).includes('storefront')) return Response.json({ data: [{ id: 'us' }] })
      entered(); await gate; return Response.json(library)
    }); const a = f.browser()
    await a.request('/device', 'POST')
    const pending = a.request('/session', 'POST', { musicUserToken: 'synthetic' })
    await started; await a.request('/session', 'DELETE'); release()
    expect((await pending).status).not.toBe(200)
    expect((await a.request()).status).toBe(401)
    const db = openStickerDatabase(f.path)
    try { expect(db.db.query.packs.findMany().sync()).toHaveLength(0) } finally { db.close() }
  })
  test('failed library import returns explicit failed inventory without erasing prior grants', async () => {
    let fail = false
    const f = fixture(async (input) => String(input).includes('storefront') ? Response.json({ data: [{ id: 'us' }] }) : fail ? new Response(null, { status: 502 }) : Response.json(library))
    const a = f.browser(); await a.request('/device', 'POST')
    const before = await (await a.request('/session', 'POST', { musicUserToken: 'synthetic' })).json()
    fail = true; f.advance()
    const after = await (await a.request('/session', 'POST', { musicUserToken: 'synthetic' })).json()
    expect(after.importStatus).toBe('failed'); expect(after.stickerIds).toEqual(before.stickerIds)
  })
  test('catalogue enrichment has no user token and stale device generation cannot write', async () => {
    const f = fixture(); const a = f.browser(); await a.request('/device', 'POST'); await a.request('/session', 'POST', { musicUserToken: 'synthetic' })
    expect((await a.request('/listening', 'POST', { eventId: 'e', streamId: 's', sequence: 0, catalogId: '456', positionMs: 0, playing: true })).status).toBe(200)
    const db = openStickerDatabase(f.path)
    try {
      const repo = createStickerRepository(db.db, () => 110000); const lease = repo.sessions.begin((a.jar.get('webpod_device') ?? 'missing'))
      repo.sessions.revoke((a.jar.get('webpod_device') ?? 'missing'))
      expect(() => repo.sessions.activate(lease, 'us', () => undefined)).toThrow()
    } finally { db.close() }
  })
})


test('logout revokes captured active access even when the device cookie is missing', async () => {
  const f = fixture(); const a = f.browser(); await a.request('/device', 'POST'); await a.request('/session', 'POST', { musicUserToken: 'synthetic' })
  const active = (a.jar.get('webpod_session') ?? 'missing')
  a.jar.delete('webpod_device')
  expect((await a.request('/session', 'DELETE')).status).toBe(200)
  a.jar.set('webpod_session', active)
  expect((await a.request()).status).toBe(401)
})
test('rapid authenticated reload reuses inventory and bounded preparation rejects excess work', async () => {
  const f = fixture(); const a = f.browser(); await a.request('/device', 'POST')
  const first = await (await a.request('/session', 'POST', { musicUserToken: 'synthetic' })).json()
  const again = await a.request('/session', 'POST', { musicUserToken: 'synthetic' })
  expect(again.status).toBe(200); expect((await again.json()).packs).toEqual(first.packs)
  for (let index = 1; index < 30; index++) expect((await f.browser().request('/device', 'POST')).status).toBe(200)
  expect((await f.browser().request('/device', 'POST')).status).toBe(429)
  expect((await f.handle(new Request('https://webpod.test/api/stickers/device', { method: 'POST', headers: { origin: 'https://attacker.test' } }))).status).toBe(403)
})
test('logout interrupts catalogue enrichment without metadata or listening credit writes', async () => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve })
  let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve })
  const f = fixture(async (input) => {
    if (String(input).includes('storefront')) return Response.json({ data: [{ id: 'us' }] })
    if (String(input).includes('/library/')) return Response.json(library)
    entered(); await gate
    return Response.json({ data: [{ id: '456', attributes: { durationInMillis: 300000, genreNames: ['Pop'] } }] })
  })
  const a = f.browser(); await a.request('/device', 'POST'); await a.request('/session', 'POST', { musicUserToken: 'synthetic' })
  const pending = a.request('/listening', 'POST', { eventId: 'event', streamId: 'stream', sequence: 0, catalogId: '456', positionMs: 0, playing: true })
  await started; await a.request('/session', 'DELETE'); release()
  expect((await pending).status).not.toBe(200)
  const db = openStickerDatabase(f.path)
  try { expect(db.db.query.tracks.findMany().sync().some((track) => track.catalogId === '456')).toBe(false); expect(db.db.query.observations.findMany().sync()).toHaveLength(0) } finally { db.close() }
})
test('runtime disposal cancels admitted upstream work and releases database ownership', async () => {
  let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve })
  const f = fixture(async (_input, init) => {
    entered()
    await new Promise<void>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) })
    return Response.json({})
  })
  const a = f.browser(); await a.request('/device', 'POST')
  const pending = a.request('/session', 'POST', { musicUserToken: 'synthetic' })
  await started; await f.dispose()
  expect((await pending).status).not.toBe(200)
  const db = openStickerDatabase(f.path); db.close()
})

test('global upstream admission is bounded and forged session secrets cannot resolve an owner', async () => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve })
  let count = 0; let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve })
  const f = fixture(async (input) => {
    if (String(input).includes('storefront')) { count++; if (count === 4) entered(); await gate; return Response.json({ data: [{ id: 'us' }] }) }
    return Response.json(library)
  })
  const browsers = Array.from({ length: 5 }, () => f.browser())
  for (const browser of browsers) await browser.request('/device', 'POST')
  const jobs = browsers.slice(0, 4).map((browser) => browser.request('/session', 'POST', { musicUserToken: 'synthetic' }))
  await started
  const fifth = browsers[4]
  if (fifth === undefined) throw new Error('Missing test browser')
  expect((await fifth.request('/session', 'POST', { musicUserToken: 'synthetic' })).status).toBe(429)
  fifth.jar.set('webpod_session', 'A'.repeat(43))
  expect((await fifth.request()).status).toBe(401)
  release()
  expect((await Promise.all(jobs)).every((response) => response.status === 200)).toBe(true)
})

test('incoming request abort cancels Apple fetch and releases device admission without grants', async () => {
  let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve })
  let aborted = false; let suspend = true
  const f = fixture(async (input, init) => {
    if (suspend) {
      entered()
      await new Promise<void>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')) }, { once: true }) })
    }
    return String(input).includes('storefront') ? Response.json({ data: [{ id: 'us' }] }) : Response.json(library)
  })
  const a = f.browser(); await a.request('/device', 'POST')
  const controller = new AbortController()
  const pending = f.handle(new Request('https://webpod.test/api/stickers/session', { method: 'POST', signal: controller.signal, headers: { origin: 'https://webpod.test', 'content-type': 'application/json', cookie: [...a.jar].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify({ musicUserToken: 'synthetic' }) }))
  await started; controller.abort()
  expect((await pending).status).not.toBe(200); expect(aborted).toBe(true)
  const db = openStickerDatabase(f.path)
  try { expect(db.db.query.sessions.findMany().sync()).toHaveLength(0); expect(db.db.query.packs.findMany().sync()).toHaveLength(0) } finally { db.close() }
  suspend = false; f.advance()
  expect((await a.request('/session', 'POST', { musicUserToken: 'synthetic' })).status).toBe(200)
})
