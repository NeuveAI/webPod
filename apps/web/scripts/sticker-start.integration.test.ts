import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import type { StickerInventory } from '@webpod/stickers'

/** Build first. This crosses the generated Start router plus Bun's native HTTP cookie transport.
 * Synthetic upstream enters only as trusted in-process Start request context. */
test('built Start routes import, open, place, reload, earn once, revoke and recover', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'webpod-start-'))
  let now = 100000
  const service = createLiveStickerServer({ databasePath: resolve(directory, 'collection.sqlite'), now: () => now, developerToken: async () => 'synthetic-developer', fetch: async (input, init) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('storefront')) return Response.json({ data: [{ id: 'us' }] })
    if (path.includes('/library/')) return Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 3600000, genreNames: ['Rock'] } }] })
    expect(new Headers(init?.headers).has('music-user-token')).toBe(false)
    return Response.json({ data: [{ id: '456', attributes: { durationInMillis: 3600000, genreNames: ['Pop'] } }] })
  } })
  const builtPath = resolve(import.meta.dirname, '../dist/server/server.js')
  const { default: entry } = await import(builtPath) as { default: { fetch(request: Request, options: { context: { stickerServer: typeof service } }): Promise<Response> } }
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: (request) => entry.fetch(request, { context: { stickerServer: service } }) })
  const jar = new Map<string, string>()
  const send = async (path = '', method = 'GET', body?: unknown) => {
    const response = await fetch(`${server.url.origin}/api/stickers${path}`, { method, headers: { origin: server.url.origin, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    for (const raw of response.headers.getSetCookie()) { const pair = (raw.split(';')[0] ?? ''); const split = pair.indexOf('='); jar.set(pair.slice(0, split), pair.slice(split + 1)) }
    expect(response.headers.get('cache-control')).toBe('no-store')
    return response
  }
  const inventory = async (response: Response): Promise<StickerInventory> => { expect(response.status).toBe(200); return await response.json() as StickerInventory }
  try {
    expect((await send()).status).toBe(401)
    expect((await send('', 'PATCH', {})).status).toBe(405)
    await send('/device', 'POST')
    const first = await inventory(await send('/session', 'POST', { musicUserToken: 'synthetic-user' }))
    expect(first.stickerIds.length).toBe(1)
    const packId = first.packs[0]?.id; const stickerId = first.stickerIds[0]
    if (packId === undefined || stickerId === undefined) throw new Error('Missing starter pack')
    await inventory(await send('/packs/open', 'POST', { packId }))
    const placed = await inventory(await send('/placements', 'PUT', { revision: 0, placements: [{ stickerId, surface: 'back', x: 0.5, y: 0.5, width: 0.2, rotationDeg: 0 }] }))
    expect(placed.placementRevision).toBe(1)
    expect((await inventory(await send())).placements).toEqual(placed.placements)
    expect((await send('', 'HEAD')).status).toBe(200)
    let last: StickerInventory = placed
    for (let sequence = 0; sequence <= 30; sequence++) {
      now += 10000
      const observation = { eventId: `event-${sequence}`, streamId: 'stream', sequence, catalogId: '456', positionMs: sequence * 10000, playing: true }
      last = await inventory(await send('/listening', 'POST', observation))
      if (sequence === 30) expect((await inventory(await send('/listening', 'POST', observation))).packs).toEqual(last.packs)
    }
    expect(last.stickerIds.length).toBe(2)
    const staleSession = (jar.get('webpod_session') ?? 'missing')
    expect((await send('/session', 'DELETE')).status).toBe(200)
    jar.set('webpod_session', staleSession)
    expect((await send()).status).toBe(401)
    now += 6000
    const recovered = await inventory(await send('/session', 'POST', { musicUserToken: 'synthetic-user-new' }))
    expect(recovered.stickerIds).toEqual(last.stickerIds)
    expect(recovered.placements).toEqual(placed.placements)
  } finally { await service.dispose(); await server.stop(true); rmSync(directory, { recursive: true, force: true }) }
})
