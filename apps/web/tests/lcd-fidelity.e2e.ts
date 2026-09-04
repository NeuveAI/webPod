import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { assertBrowserSourceIdentity } from './source-identity'

const evidenceDirectory = resolve(
  process.env['LCD_FIDELITY_EVIDENCE_DIR'] ?? resolve(import.meta.dirname, 'test-results/lcd-fidelity'),
)
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PRODUCT_ROUTE = '/_spike/device?capture=&view=front&colourway=black'

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

async function gotoProduct(page: Page): Promise<void> {
  await page.goto(PRODUCT_ROUTE, { waitUntil: 'domcontentloaded' })
  await assertBrowserSourceIdentity(page)
  await expect(page.locator('.webpod-device-preview__device canvas').first()).toBeVisible()
  await expect(page.getByRole('application', { name: 'webPod music player', includeHidden: true })).toBeAttached()
}

async function installDeterministicAppleMusic(page: Page): Promise<void> {
  await page.route('**/api/apple/developer-token', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: 'browser-proof-token', expiresAt: 4_102_444_800 }),
  }))
  await page.addInitScript(() => {
    type Listener = (event: unknown) => void
    type Resource = { readonly id: string; readonly type: string; readonly attributes: Readonly<Record<string, unknown>> }
    const listeners = new Map<string, Set<Listener>>()
    const tracks: readonly Resource[] = Array.from({ length: 11 }, (_, index) => ({
      id: `library-song-${String(index + 1)}`,
      type: 'library-songs',
      attributes: {
        name: index === 0 ? 'A Deliberately Spacious Track Title' : `Reference Track ${String(index + 1)}`,
        artistName: 'Reference Artist',
        albumName: 'Reference Album',
        durationInMillis: 246_000 + index * 1_000,
        playable: true,
        playParams: { globalId: `catalog-song-${String(index + 1)}` },
      },
    }))
    const collections: Readonly<Record<string, readonly Resource[]>> = {
      playlists: [{ id: 'library-playlist-1', type: 'library-playlists', attributes: { name: 'Reference Playlist', trackCount: 11, canEdit: true, playParams: { globalId: 'catalog-playlist-1' } } }],
      artists: [{ id: 'library-artist-1', type: 'library-artists', attributes: { name: 'Reference Artist', playParams: { globalId: 'catalog-artist-1' } } }],
      albums: [{ id: 'library-album-1', type: 'library-albums', attributes: { name: 'Reference Album', artistName: 'Reference Artist', trackCount: 11, releaseDate: '2005-10-12', playParams: { globalId: 'catalog-album-1' } } }],
      songs: tracks,
    }
    const queue = { items: [] as readonly Resource[], position: 0 }
    const music = {
      api: {
        async music(path: string) {
          const collection = path.match(/^\/v1\/me\/library\/(playlists|artists|albums|songs)$/u)?.[1]
          if (collection !== undefined) return { data: collections[collection] ?? [], meta: { total: collections[collection]?.length ?? 0 } }
          if (path === '/v1/me/library/albums/library-album-1/tracks') return { data: tracks }
          if (path === '/v1/catalog/us/stations') return { data: [] }
          return { data: [] }
        },
        async search() { return { data: { results: {} } } },
        async artistRelationship() { return { data: [] } },
        async playlistRelationship() { return { data: [] } },
        async songRelationship() { return { data: [] } },
        async station() { return { data: [] } },
        async stations() { return { data: [] } },
      },
      isAuthorized: true,
      storefrontId: 'us',
      playbackState: 0,
      currentPlaybackTime: 0,
      currentPlaybackDuration: 0,
      nowPlayingItem: null as Resource | null,
      queue,
      volume: 1,
      shuffleMode: 0,
      repeatMode: 0,
      async authorize() { return 'browser-proof-user' },
      async unauthorize() {},
      async setQueue(options: Readonly<Record<string, unknown>>) {
        const songs = Array.isArray(options['songs']) ? options['songs'] : []
        queue.items = tracks.filter((track) => songs.includes(track.attributes['playParams'] instanceof Object ? (track.attributes['playParams'] as { globalId?: string }).globalId : undefined))
        queue.position = typeof options['startPosition'] === 'number' ? options['startPosition'] : 0
        music.nowPlayingItem = queue.items[queue.position] ?? null
        return queue
      },
      async play() { await new Promise<void>(() => undefined) },
      async pause() {},
      async skipToNextItem() {},
      async skipToPreviousItem() {},
      async seekToTime() {},
      async playLater() {},
      async playNext() {},
      addEventListener(name: string, listener: Listener) {
        const entries = listeners.get(name) ?? new Set<Listener>()
        entries.add(listener)
        listeners.set(name, entries)
      },
      removeEventListener(name: string, listener: Listener) { listeners.get(name)?.delete(listener) },
      __emit(name: string) { for (const listener of listeners.get(name) ?? []) listener({ type: name }) },
    }
    ;(globalThis as typeof globalThis & { MusicKit?: unknown }).MusicKit = {
      async configure() { return music },
      getInstance() { return music },
      PlaybackStates: { none: 0, loading: 1, paused: 2, playing: 3, waiting: 8 },
      PlayerShuffleMode: { off: 0, songs: 1, albums: 2 },
      PlayerRepeatMode: { off: 0, one: 1, all: 2 },
    }
  })
}

async function repaintComposite(page: Page): Promise<void> {
  await page.locator('.wp-panel').evaluate((panel) => {
    const source = panel.closest('canvas')
    if (source === null || !('requestPaint' in source)) throw new Error('production panel raster cannot request paint')
    const requestPaint = Reflect.get(source, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('production panel requestPaint is not callable')
    Reflect.apply(requestPaint, source, [])
  })
  await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))))
}

const freezeVisuals = (page: Page) => page.addStyleTag({
  content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
})

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('the public root resolves only to the canonical Apple-backed device', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/_spike\/device$/)
  await assertBrowserSourceIdentity(page)
  await expect(page.getByRole('button', { name: /demo library/i })).toHaveCount(0)
  await expect(page.locator('.wp-composite-preview, .wp-composite-preview__bare-frame')).toHaveCount(0)
  await expect(page.locator('.webpod-device-preview__device')).toHaveCount(1)
})

test('production LCD keeps the measured native raster and title geometry', async ({ page }) => {
  await gotoProduct(page)
  const panel = page.getByRole('application', { name: 'webPod music player', includeHidden: true })
  const geometry = await panel.evaluate((element) => {
    const screen = element.querySelector<HTMLElement>('.wp-screen')
    const title = element.querySelector<HTMLElement>('.wp-titlebar')
    if (screen === null || title === null) throw new Error('production LCD geometry is absent')
    return {
      panel: { width: screen.offsetWidth, height: screen.offsetHeight },
      title: { width: title.offsetWidth, height: title.offsetHeight },
    }
  })
  expect(geometry.panel).toEqual({ width: 272, height: 204 })
  expect(geometry.title).toEqual({ width: 272, height: 21 })
  await expect(panel.locator('.wp-list-preview, .wp-status-shelf, .wp-now-count')).toHaveCount(0)
})

for (const viewport of [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
] as const) {
  test(`captures the canonical production device at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installDeterministicAppleMusic(page)
    await gotoProduct(page)
    await freezeVisuals(page)
    const panel = page.locator('.wp-panel')
    await expect(panel).toHaveAttribute('data-screen', 'S03')
    await panel.focus()
    await panel.press('Enter')
    await expect(panel.getByRole('listbox', { name: 'Albums' })).toBeAttached()
    await panel.press('Enter')
    await expect(panel.getByRole('listbox', { name: /tracks$/ })).toBeAttached()
    await expect(panel.locator('.wp-list-row')).toHaveCount(8)
    const listGeometry = await panel.evaluate((element) => {
      const screen = element.querySelector<HTMLElement>('.wp-screen')
      const viewport = element.querySelector<HTMLElement>('.wp-list-viewport')
      const rail = element.querySelector<HTMLElement>('.wp-list-body > .wp-list-scroll')
      const rows = [...element.querySelectorAll<HTMLElement>('.wp-list-row')]
      if (screen === null || viewport === null || rail === null) throw new Error('production list geometry is absent')
      return { screen: [screen.offsetWidth, screen.offsetHeight], viewportWidth: viewport.offsetWidth, railWidth: rail.offsetWidth, rowHeights: rows.map((row) => row.offsetHeight) }
    })
    expect(listGeometry).toEqual({ screen: [272, 204], viewportWidth: 263, railWidth: 5, rowHeights: Array.from({ length: 8 }, () => 23) })
    await repaintComposite(page)
    await page.locator('.webpod-device-preview__stage').screenshot({
      path: resolve(evidenceDirectory, `production-device-list-${viewport.name}.png`),
    })
    await page.evaluate(() => {
      type ProofMusic = { playbackState: number; __emit(name: string): void }
      const musicKit = (globalThis as typeof globalThis & { MusicKit?: { getInstance(): unknown } }).MusicKit
      if (musicKit === undefined) throw new Error('MusicKit proof seam is absent')
      const music = musicKit.getInstance() as ProofMusic
      music.playbackState = 1
      music.__emit('playbackStateDidChange')
    })
    await panel.press('Enter')
    await expect(panel).toHaveAttribute('data-screen', 'S13')
    await expect(panel.locator('.wp-now')).toHaveAttribute('data-playback-indeterminate', 'true')
    const progress = panel.getByRole('progressbar', { name: 'Loading playback' })
    await expect(progress).not.toHaveAttribute('aria-valuenow')
    await expect(panel.locator('.wp-status-shelf, .wp-now-count')).toHaveCount(0)
    await repaintComposite(page)
    await page.locator('.webpod-device-preview__stage').screenshot({
      path: resolve(evidenceDirectory, `loading-device-${viewport.name}.png`),
    })

    await page.evaluate(() => {
      type ProofMusic = {
        playbackState: number
        currentPlaybackTime: number
        currentPlaybackDuration: number
        __emit(name: string): void
      }
      const musicKit = (globalThis as typeof globalThis & { MusicKit?: { getInstance(): unknown } }).MusicKit
      if (musicKit === undefined) throw new Error('MusicKit proof seam is absent')
      const music = musicKit.getInstance() as ProofMusic
      music.playbackState = 3
      music.currentPlaybackDuration = 246
      music.currentPlaybackTime = 0
      music.__emit('nowPlayingItemDidChange')
      music.__emit('playbackStateDidChange')
      music.__emit('playbackTimeDidChange')
      music.currentPlaybackTime = 86.1
      music.__emit('playbackTimeDidChange')
    })
    await expect(panel.locator('.wp-now')).toHaveAttribute('data-playback-phase', 'ready')
    await expect(panel.getByRole('progressbar', { name: 'Playback position' })).toHaveAttribute('aria-valuenow', '86100')
    await repaintComposite(page)
    await page.locator('.webpod-device-preview__stage').screenshot({
      path: resolve(evidenceDirectory, `progress-device-${viewport.name}.png`),
    })

    await panel.dispatchEvent('wheel', { deltaY: -80, deltaMode: 0 })
    await expect(panel.getByRole('progressbar', { name: 'Volume' })).toBeAttached()
    await repaintComposite(page)
    await page.locator('.webpod-device-preview__stage').screenshot({
      path: resolve(evidenceDirectory, `volume-device-${viewport.name}.png`),
    })
  })
}
