import { expect, test } from 'bun:test'
import { createFixtureProvider, APPLE_SUPPORTS } from '@webpod/providers'
import { musicManager } from '@webpod/music-management'
import { setup } from '../../../packages/providers/src/apple/test-fixtures'
import { createMusicRuntimeController, musicRuntimeReady } from './music-runtime'
import { createWelcomeEntry } from './welcome-entry'

function runtime() {
  const { provider, music } = setup()
  const spotify = createFixtureProvider({ supports: APPLE_SUPPORTS })
  const controller = createMusicRuntimeController(provider, spotify, {
    restore() {}, start() {}, async bootstrap() { throw new Error('optional sticker 401') }, disconnect() {},
  })
  let navigations = 0
  const enter = createWelcomeEntry(controller.musicRuntime.getSnapshot)
  const finish = async (result: Awaited<ReturnType<typeof controller.authorizeAppleRuntime>>) => result.ready && enter(result.snapshot, async current => {
    if (!current()) return false
    navigations += 1
    return true
  })
  return { ...controller, music, provider, spotify, enter, finish, navigations: () => navigations,
    dispose() { musicManager(provider).dispose(); musicManager(spotify).dispose() },
  }
}

for (const status of [403, 500]) test(`welcome rejects resolved Apple auth result after initial library ${status}, then retries successfully`, async () => {
  const r = runtime()
  const albums = r.music.api.library.albums
  r.music.api.library.albums = async () => { throw new Error(String(status)) }
  try {
    const failed = await r.authorizeAppleRuntime()
    expect(failed.snapshot.provider.session?.status).toBe('authorized')
    expect(failed.snapshot.phase).toBe('error')
    expect(await r.finish(failed)).toBe(false)
    expect(r.navigations()).toBe(0)
    r.music.api.library.albums = albums
    expect(await r.finish(await r.authorizeAppleRuntime())).toBe(true)
    expect(r.navigations()).toBe(1)
  } finally { r.dispose() }
})

test('cancelled Apple authorization stays on welcome even though configure restored a session', async () => {
  const r = runtime()
  r.music.authorize = async () => undefined
  try {
    const result = await r.authorizeAppleRuntime()
    expect(result.ready).toBe(false)
    expect(result.snapshot.phase).toBe('permission-denied')
    expect(await r.finish(result)).toBe(false)
    expect(r.navigations()).toBe(0)
  } finally { r.dispose() }
})

for (const mode of ['apple', 'spotify'] as const) test(`${mode} restore uses shared readiness and accepts empty libraries`, async () => {
  const r = runtime()
  if (mode === 'apple') {
    for (const kind of ['albums', 'artists', 'playlists', 'songs'] as const) r.music.api.library[kind] = async () => []
  } else r.spotify.libraryList = async () => ({ items: [], next: null, total: 0 })
  try {
    const result = await r.selectMusicRuntime(mode)
    expect(result.ready).toBe(true)
    expect(musicRuntimeReady(result.snapshot)).toBe(true)
    expect(result.snapshot.source.songs).toEqual([])
    expect(await r.finish(result)).toBe(true)
    expect(r.navigations()).toBe(1)
  } finally { r.dispose() }
})

for (const mode of ['apple', 'spotify'] as const) test(`${mode} restore/callback library failure cannot enter player`, async () => {
  const r = runtime()
  if (mode === 'apple') r.music.api.library.albums = async () => { throw new Error('403') }
  else r.spotify.libraryList = async () => { throw new Error('500') }
  try {
    const result = await r.selectMusicRuntime(mode)
    expect(result.ready).toBe(false)
    expect(await r.finish(result)).toBe(false)
    expect(r.navigations()).toBe(0)
  } finally { r.dispose() }
})

test('provider change during authorization cannot borrow newer ready state', async () => {
  const r = runtime()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  r.music.authorize = async () => { await gate; return 'synthetic-user' }
  try {
    const pending = r.authorizeAppleRuntime()
    await Promise.resolve(); await Promise.resolve()
    const newer = await r.selectMusicRuntime('spotify')
    release()
    const old = await pending
    expect(old.ready).toBe(false)
    expect(await r.finish(old)).toBe(false)
    expect(await r.finish(newer)).toBe(true)
    expect(r.navigations()).toBe(1)
  } finally { release(); r.dispose() }
})

test('exit animation rechecks exact runtime and suppresses concurrent entry', async () => {
  const r = runtime()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  try {
    const initial = await r.authorizeAppleRuntime()
    const pending = r.enter(initial.snapshot, async current => { await gate; if (!current()) return false; throw new Error('stale navigation') })
    expect(await r.finish(initial)).toBe(false)
    const next = await r.selectMusicRuntime('spotify')
    release()
    expect(await pending).toBe(false)
    expect(await r.finish(next)).toBe(true)
    expect(r.navigations()).toBe(1)
  } finally { release(); r.dispose() }
})

test('optional sticker bootstrap rejection does not fail required music readiness', async () => {
  const { provider } = setup()
  const spotify = createFixtureProvider({ supports: APPLE_SUPPORTS })
  let stickerFailures = 0
  const controller = createMusicRuntimeController(provider, spotify, {
    restore() {}, disconnect() {},
    async bootstrap() { throw new Error('optional sticker 401') },
    start(_provider, bootstrap) { void bootstrap().catch(() => { stickerFailures += 1 }) },
  })
  try {
    const result = await controller.authorizeAppleRuntime()
    expect(result.ready).toBe(true)
    expect(stickerFailures).toBe(1)
  } finally { musicManager(provider).dispose(); musicManager(spotify).dispose() }
})

test('rejected Apple authorization never enters and a retry remains available', async () => {
  const r = runtime()
  const authorize = r.music.authorize
  r.music.authorize = async () => { throw new Error('synthetic authorization failure') }
  try {
    expect(await r.finish(await r.authorizeAppleRuntime())).toBe(false)
    expect(r.musicRuntime.getSnapshot().phase).toBe('error')
    r.music.authorize = authorize
    expect(await r.finish(await r.authorizeAppleRuntime())).toBe(true)
    expect(r.navigations()).toBe(1)
  } finally { r.dispose() }
})
