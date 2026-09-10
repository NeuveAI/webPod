import { afterEach, expect, test } from 'bun:test'
import { spotifyRoute } from './spotify'

const originalFetch = globalThis.fetch
const originalId = process.env['SPOTIFY_CLIENT_ID']
const originalSecret = process.env['SPOTIFY_CLIENT_SECRET']
const origin = 'https://webpod.example'
const sessionCookie = (response: Response, name: string) =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split(';')[0] ?? ''
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalId === undefined) delete process.env['SPOTIFY_CLIENT_ID']
  else process.env['SPOTIFY_CLIENT_ID'] = originalId
  if (originalSecret === undefined) delete process.env['SPOTIFY_CLIENT_SECRET']
  else process.env['SPOTIFY_CLIENT_SECRET'] = originalSecret
})

/** Exercises the public HTTP boundary with fake upstream credentials, never live tokens. */
test('Spotify OAuth validates state, seals credentials, refreshes and rejects cross-site access', async () => {
  process.env['SPOTIFY_CLIENT_ID'] = 'test-client'
  process.env['SPOTIFY_CLIENT_SECRET'] = 'test-secret-only'
  const calls: URLSearchParams[] = []
  globalThis.fetch = Object.assign(
    async (_input: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body))
      calls.push(body)
      return Response.json({
        access_token: calls.length === 1 ? 'first-access' : 'refreshed-access',
        refresh_token: 'fake-refresh',
        expires_in: calls.length === 1 ? 1 : 3600,
      })
    },
    { preconnect: originalFetch.preconnect },
  )
  const login = await spotifyRoute(
    new Request(`${origin}/api/spotify/login`),
    'login',
  )
  const location = new URL(login.headers.get('location') ?? '')
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
  expect(location.searchParams.get('redirect_uri')).toBe(
    `${origin}/api/spotify/callback`,
  )
  const flowCookie = sessionCookie(login, 'webpod_spotify_flow')
  expect(login.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax')
  expect(login.headers.get('set-cookie')).toContain('Secure')
  const bad = await spotifyRoute(
    new Request(`${origin}/api/spotify/callback?code=fake&state=wrong`, {
      headers: { cookie: flowCookie },
    }),
    'callback',
  )
  expect(bad.headers.get('location')).toBe('/?spotify=invalid-state')
  expect(calls.length).toBe(0)
  const callback = await spotifyRoute(
    new Request(
      `${origin}/api/spotify/callback?${new URLSearchParams({ code: 'fake-code', state: location.searchParams.get('state') ?? '' })}`,
      { headers: { cookie: flowCookie } },
    ),
    'callback',
  )
  expect(callback.headers.get('location')).toBe('/?music=spotify')
  expect(calls[0]?.get('code_verifier')?.length).toBeGreaterThan(40)
  const cookie = sessionCookie(callback, 'webpod_spotify')
  expect(cookie).not.toContain('fake-refresh')
  expect(cookie).not.toContain('first-access')
  const token = await spotifyRoute(
    new Request(`${origin}/api/spotify/token`, {
      method: 'POST',
      headers: { origin, cookie },
    }),
    'token',
  )
  expect(await token.json()).toEqual({
    accessToken: 'refreshed-access',
    expiresAt: expect.any(Number),
  })
  expect(calls[1]?.get('grant_type')).toBe('refresh_token')
  expect(token.headers.get('cache-control')).toBe('no-store')
  const crossSite = await spotifyRoute(
    new Request(`${origin}/api/spotify/token`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', cookie },
    }),
    'token',
  )
  expect(crossSite.status).toBe(403)
  const tampered = await spotifyRoute(
    new Request(`${origin}/api/spotify/token`, {
      method: 'POST',
      headers: { origin, cookie: `${cookie}invalid` },
    }),
    'token',
  )
  expect(tampered.status).toBe(401)
  const logout = await spotifyRoute(
    new Request(`${origin}/api/spotify/logout`, {
      method: 'POST',
      headers: { origin, cookie },
    }),
    'logout',
  )
  expect(logout.status).toBe(204)
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
})
