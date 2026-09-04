import type { Page } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'

/** Deterministic provider seam for production-route geometry and input checks. */
export async function installDeterministicAppleMusic(page: Page): Promise<void> {
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

