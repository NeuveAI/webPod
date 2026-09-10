import { afterEach, expect, test } from 'bun:test'
import { createSpotifyApi } from './api'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
function responses(reply: (method: string) => Response): void {
  globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === '/api/spotify/token') return Response.json({ accessToken: 'synthetic-token', expiresAt: Date.now() + 3600000 })
    return reply(init?.method ?? 'GET')
  }, { preconnect: originalFetch.preconnect })
}

test('JSON reads and entity-creating writes still decode response data', async () => {
  responses((method) => Response.json(method === 'POST' ? { id: 'created-playlist' } : { items: [] }))
  const api = createSpotifyApi()
  expect(await api.request('me/playlists')).toEqual({ items: [] })
  expect(await api.request('me/playlists', 'POST', { name: 'Test' })).toEqual({ id: 'created-playlist' })
})

test('opaque bodies remain errors for JSON reads and entity-creating writes', async () => {
  responses(() => new Response(new TextEncoder().encode('synthetic-opaque-response'), { status: 200 }))
  const api = createSpotifyApi()
  await expect(api.request('me/playlists')).rejects.toBeInstanceOf(SyntaxError)
  await expect(api.request('me/playlists', 'POST', { name: 'Test' })).rejects.toBeInstanceOf(SyntaxError)
})

for (const status of [200, 204]) test(`command ${status} acknowledges status without interpreting response bytes`, async () => {
  responses(() => new Response(status === 204 ? null : new TextEncoder().encode('synthetic-opaque-ack'), { status }))
  const api = createSpotifyApi()
  await expect(api.command('me/player/play', 'PUT')).resolves.toBeUndefined()
})

for (const status of [403, 429, 500]) test(`command ${status} remains a rejected action`, async () => {
  responses(() => new Response(new TextEncoder().encode('synthetic-error'), { status }))
  await expect(createSpotifyApi().command('me/player/play', 'PUT')).rejects.toThrow(status === 403 ? 'denied' : status === 429 ? 'busy' : String(status))
})

test('command mode does not bypass token JSON validation', async () => {
  globalThis.fetch = Object.assign(async () => new Response(new TextEncoder().encode('synthetic-invalid-token-response'), { status: 200 }), { preconnect: originalFetch.preconnect })
  await expect(createSpotifyApi().command('me/player/play', 'PUT')).rejects.toBeInstanceOf(SyntaxError)
})

test('command acknowledgement retains the existing one-time 401 refresh retry', async () => {
  let tokens = 0
  let commands = 0
  globalThis.fetch = Object.assign(async (input: string | URL | Request) => {
    if (String(input) === '/api/spotify/token') {
      tokens += 1
      return Response.json({ accessToken: 'synthetic-token', expiresAt: Date.now() + 3600000 })
    }
    commands += 1
    return new Response(new TextEncoder().encode('synthetic-response'), { status: commands === 1 ? 401 : 200 })
  }, { preconnect: originalFetch.preconnect })
  await createSpotifyApi().command('me/player/play', 'PUT')
  expect({ tokens, commands }).toEqual({ tokens: 2, commands: 2 })
})
