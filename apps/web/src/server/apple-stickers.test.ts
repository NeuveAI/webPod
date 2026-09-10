import { describe, expect, test } from 'bun:test'
import { appleStickersRoute } from './apple-stickers.server'
const request = (body: unknown, origin = 'https://webpod.test') => new Request('https://webpod.test/api/apple/stickers', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('stateless Apple sticker metadata', () => {
  test('rejects cross-origin and malformed requests before signing', async () => {
    let signed = 0
    const options = { developerToken: async () => { signed++; return 'test-only-token' } }
    expect((await appleStickersRoute(request({ action: 'import', musicUserToken: 'test' }, 'https://other.test'), options)).status).toBe(403)
    expect((await appleStickersRoute(request({ action: 'enrich', catalogId: '../oops', storefront: 'us' }), options)).status).toBe(400)
    expect((await appleStickersRoute(request({ action: 'import', musicUserToken: '' }), options)).status).toBe(400)
    expect(signed).toBe(0)
  })
  test('returns sanitized library metadata with no collection cookies', async () => {
    const urls: string[] = []
    const fetcher = Object.assign(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return String(input).endsWith('/storefront') ? Response.json({ data: [{ id: 'us' }] }) : Response.json({ data: [{ id: 'library-private-id', attributes: { playParams: { catalogId: '123' }, durationInMillis: 123000, genreNames: ['Rock'] } }] })
    }, { preconnect: fetch.preconnect })
    const response = await appleStickersRoute(request({ action: 'import', musicUserToken: 'test-user-token' }), { developerToken: async () => 'test-developer-token', fetch: fetcher })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.json()).toEqual({ tracks: [{ catalogId: '123', genre: 'rock', durationMs: 123000 }], status: 'complete', storefront: 'us' })
    expect(urls.every(url => url.startsWith('https://api.music.apple.com/'))).toBe(true)
  })
})
