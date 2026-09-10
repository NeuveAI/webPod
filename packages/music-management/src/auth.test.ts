import { expect, test } from 'bun:test'
import { createFixtureProvider, spotifyMusicAuth, appleMusicAuth, type Session, type MusicProvider } from '@webpod/providers'
import { setup } from '../../providers/src/apple/test-fixtures'
import { createMusicAuth, musicAuthReady } from './auth'

function controlled() {
  const base = createFixtureProvider()
  const initialSession = base.session
  if (initialSession === null) throw new Error('fixture session missing')
  let session: Session | null = initialSession
  const listeners = new Set<(session: Session | null) => void>()
  const provider: MusicProvider = { ...base, get session() { return session }, onSessionChange(fn) { listeners.add(fn); return () => { listeners.delete(fn) } } }
  return { provider, change(value: Session | null) { session = value; for (const fn of listeners) fn(value) }, session: initialSession }
}

for (const change of ['account', 'logout'] as const) test(`${change} during initial data hydration fences old data and settles readiness`, async () => {
  const c = controlled()
  let resolve!: (value: string[]) => void
  const gate = new Promise<string[]>(done => { resolve = done })
  const auth = createMusicAuth({ connectors: { spotify: spotifyMusicAuth(c.provider) }, initialMode: 'spotify', empty: [] as string[], load: () => gate })
  try {
    const pending = auth.restore('spotify')
    await Promise.resolve(); await Promise.resolve()
    c.change(change === 'logout' ? null : { ...c.session, userIdentifier: 'new-account' })
    resolve(['old-account-data'])
    expect((await pending).ready).toBe(false)
    expect(auth.getSnapshot().source).toEqual([])
    expect(auth.getSnapshot().phase).not.toBe('signing-in')
    expect(musicAuthReady(auth.getSnapshot())).toBe(false)
  } finally { auth.dispose() }
})

test('Spotify redirect does not authorize or load until callback restore', async () => {
  const c = controlled()
  let loads = 0
  let nativeAuthorizations = 0
  c.provider.authorize = async () => { nativeAuthorizations += 1; return c.session }
  const auth = createMusicAuth({ connectors: { spotify: spotifyMusicAuth(c.provider) }, initialMode: 'spotify', empty: [] as string[], async load() { loads += 1; return [] } })
  try {
    const redirect = await auth.authorize('spotify')
    expect(redirect.redirect).toBe('/api/spotify/login')
    expect(redirect.ready).toBe(false)
    expect(loads).toBe(0)
    expect(nativeAuthorizations).toBe(0)
    expect((await auth.restore('spotify')).ready).toBe(true)
    expect(loads).toBe(1)
  } finally { auth.dispose() }
})

test('Apple gesture connector performs native authorization; disposal invalidates accepted snapshot', async () => {
  const { provider, music } = setup()
  const auth = createMusicAuth({ connectors: { apple: appleMusicAuth(provider) }, initialMode: 'apple', empty: [] as string[], async load() { return [] } })
  const result = await auth.authorize('apple')
  expect(result.ready).toBe(true)
  expect(music.calls).toContain('authorize')
  let notifications = 0
  auth.subscribe(() => { notifications += 1 })
  auth.dispose()
  expect(auth.getSnapshot()).not.toBe(result.snapshot)
  expect(musicAuthReady(auth.getSnapshot())).toBe(false)
  expect(notifications).toBe(1)
})

test('logout retires immediately without activating again while native logout is pending', async () => {
  const c = controlled()
  let resolve!: () => void
  c.provider.unauthorize = () => new Promise<void>(done => { resolve = done })
  let begins = 0
  let retired = 0
  const auth = createMusicAuth({ connectors: { spotify: spotifyMusicAuth(c.provider) }, initialMode: 'spotify', empty: [] as string[], async load() { return [] }, begin() { begins += 1 }, retire() { retired += 1 } })
  await auth.restore('spotify')
  const pending = auth.logout()
  expect(begins).toBe(1)
  expect(retired).toBe(1)
  expect(musicAuthReady(auth.getSnapshot())).toBe(false)
  resolve(); await pending
  expect(auth.getSnapshot().phase).toBe('signed-out')
  auth.dispose()
})
