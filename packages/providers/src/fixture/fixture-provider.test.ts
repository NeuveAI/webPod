import { describe, expect, test } from 'bun:test'

import { CAPABILITIES } from '../capability.ts'
import type { Capability } from '../capability.ts'
import { CapabilityUnsupportedError } from '../errors.ts'
import { isLocalKey } from '../identity.ts'
import type { TrackRef } from '../identity.ts'
import { createFixtureCatalog } from './catalog.ts'
import { createFixtureProvider } from './fixture-provider.ts'

describe('the fixture catalogue', () => {
  test('is populated enough for every screen to render something honest', () => {
    const catalog = createFixtureCatalog()
    expect(catalog.albums.length).toBeGreaterThanOrEqual(4)
    expect(catalog.tracks.length).toBeGreaterThanOrEqual(40)
    expect(catalog.artists.length).toBeGreaterThanOrEqual(4)
    expect(catalog.playlists.length).toBeGreaterThanOrEqual(2)
    expect(catalog.stations.length).toBeGreaterThanOrEqual(3)
    expect(catalog.genres.length).toBeGreaterThanOrEqual(3)
    expect(catalog.composers.length).toBeGreaterThanOrEqual(3)
  })

  test('every entity holds a LocalKey and none holds a provider id as one', () => {
    const catalog = createFixtureCatalog()
    const entities = [
      ...catalog.tracks,
      ...catalog.albums,
      ...catalog.artists,
      ...catalog.playlists,
      ...catalog.stations,
      ...catalog.genres,
      ...catalog.composers,
    ]
    for (const entity of entities) {
      expect(isLocalKey(entity.key)).toBe(true)
      expect(entity.key).not.toBe(entity.catalogId)
    }
  })

  test('keys are unique across the whole catalogue', () => {
    const catalog = createFixtureCatalog()
    const keys = [
      ...catalog.tracks,
      ...catalog.albums,
      ...catalog.artists,
      ...catalog.playlists,
      ...catalog.stations,
      ...catalog.genres,
      ...catalog.composers,
    ].map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('two catalogues share titles and share no keys', () => {
    // Two libraries that happen to hold the same record are not the same
    // library, and a key that collided across them would merge two devices'
    // star ratings.
    const a = createFixtureCatalog()
    const b = createFixtureCatalog()
    expect(a.albums.map((x) => x.title)).toEqual(b.albums.map((x) => x.title))
    const aKeys = new Set(a.tracks.map((t) => t.key))
    expect(b.tracks.some((t) => aKeys.has(t.key))).toBe(false)
  })

  test('album track lists are complete and in order', () => {
    const catalog = createFixtureCatalog()
    for (const album of catalog.albums) {
      const tracks = catalog.tracksByAlbum.get(album.key)
      expect(tracks).toBeDefined()
      expect(tracks).toHaveLength(album.trackCount)
      for (const track of tracks ?? []) expect(track.albumName).toBe(album.title)
    }
  })
})

describe('the fixture provider — the configurable matrix', () => {
  test('supports everything by default, because it holds its own data', () => {
    const provider = createFixtureProvider()
    for (const capability of CAPABILITIES) {
      expect(provider.supports(capability)).toBe(true)
      expect(provider.unsupportedReason(capability)).toBeNull()
    }
  })

  test('a capability can be turned off one at a time', () => {
    for (const capability of CAPABILITIES) {
      const provider = createFixtureProvider({ supports: { [capability]: false } })
      expect(provider.supports(capability)).toBe(false)
      const others = CAPABILITIES.filter((c) => c !== capability)
      expect(others.every((c) => provider.supports(c))).toBe(true)
    }
  })

  test('every capability that is off has a non-empty reason', () => {
    // §14.4: the reason is rendered verbatim to a human. An empty string would
    // render as a blank line where an explanation was promised.
    for (const capability of CAPABILITIES) {
      const provider = createFixtureProvider({ supports: { [capability]: false } })
      const reason = provider.unsupportedReason(capability)
      expect(typeof reason).toBe('string')
      expect((reason ?? '').length).toBeGreaterThan(0)
      expect(reason).not.toContain('!')
    }
  })

  test('a caller can override the reason copy', () => {
    const provider = createFixtureProvider({
      supports: { lyrics: false },
      unsupportedReasons: { lyrics: 'No lyrics for this one.' },
    })
    expect(provider.unsupportedReason('lyrics')).toBe('No lyrics for this one.')
  })
})

describe('the fixture provider — a missing capability is a tripwire, not an error path', () => {
  /** Calls the method each capability gates, with arguments it will accept. */
  const invoke: Partial<Record<Capability, (p: ReturnType<typeof createFixtureProvider>) => Promise<unknown>>> = {
    auth: (p) => p.authorize(),
    search: (p) => p.search({ term: 'vienna', scope: 'library', kinds: ['track'] }),
    libraryRead: (p) => p.libraryList('albums'),
    libraryAdd: (p) => p.libraryAdd(first(p)),
    libraryRemove: (p) => p.libraryRemove(first(p)),
    playlistCreate: (p) => p.playlistCreate({ name: 'Scratch' }),
    playlistAddTracks: (p) => p.playlistAddTracks(playlist(p), [first(p)]),
    playlistRemoveTracks: (p) => p.playlistRemoveTracks(playlist(p), [0]),
    playlistReorder: (p) => p.playlistReorder(playlist(p), 0, 1),
    transport: (p) => p.play(),
    seek: (p) => p.seek(1000),
    volume: (p) => p.setVolume(50),
    queueRead: (p) => p.queueRead(),
    queueAppend: (p) => p.queueAppend([first(p)]),
    queueInsertNext: (p) => p.queueInsertNext([first(p)]),
    queueRemove: (p) => p.queueRemove([0]),
    queueReorder: (p) => p.queueReorder(0, 1),
    stations: (p) => p.stationsList(),
    stationSeedFromTrack: (p) => p.stationStart({ type: 'track', ref: first(p).catalogId }),
    lyrics: (p) => p.lyrics(first(p)),
    ratingLoveDislike: (p) => p.ratingSet(first(p), { love: 'love' }),
    saveToggle: (p) => p.saveToggle(first(p), true),
  }

  function first(p: ReturnType<typeof createFixtureProvider>): TrackRef {
    const track = p.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')
    return track
  }

  function playlist(p: ReturnType<typeof createFixtureProvider>) {
    const found = p.catalog.playlists[0]
    if (found === undefined) throw new Error('empty fixture catalogue')
    return found
  }

  for (const [capability, call] of Object.entries(invoke)) {
    test(`${capability} throws a tagged error when it is off`, async () => {
      const provider = createFixtureProvider({ supports: { [capability]: false } })
      let thrown: unknown = null
      try {
        await call(provider)
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(CapabilityUnsupportedError)
      const typed = thrown as CapabilityUnsupportedError
      expect(typed._tag).toBe('CapabilityUnsupported')
      expect(typed.capability).toBe(capability)
      // The error carries the same copy `unsupportedReason` returns, so a
      // caller that does surface it has the right words already.
      const reason = provider.unsupportedReason(capability as Capability)
      expect(reason).not.toBeNull()
      expect(typed.reason).toBe(reason ?? '')
    })
  }

  test('onProgress stays subscribable when progressTicks is off', () => {
    // The one capability whose `false` hides no control: it reports whether the
    // provider emits a tick, not whether position is knowable (§14.3 row 25).
    const provider = createFixtureProvider({ supports: { progressTicks: false } })
    const seen: boolean[] = []
    provider.onProgress((p) => seen.push(p.interpolated))
    void provider.play()
    expect(seen).toEqual([true])
  })
})

describe('the fixture provider — behaviour', () => {
  test('plays an album and advances through it on tick', async () => {
    const provider = createFixtureProvider()
    const album = provider.catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')
    const tracks = provider.catalog.tracksByAlbum.get(album.key) ?? []

    await provider.play({ kind: 'album', album })
    expect(provider.playback.now?.key).toBe(tracks[0]?.key)
    expect(provider.playback.status).toBe('playing')

    provider.tick((tracks[0]?.durationMs ?? 0) + 1000)
    expect(provider.playback.now?.key).toBe(tracks[1]?.key)
    expect(provider.playback.positionMs).toBe(1000)
  })

  test('runs no timer of its own — position only moves when ticked', async () => {
    const provider = createFixtureProvider()
    const album = provider.catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')
    await provider.play({ kind: 'album', album })
    const before = provider.playback.positionMs
    await Bun.sleep(25)
    expect(provider.playback.positionMs).toBe(before)
  })

  test('Love and Save are different stores and never alias (§14.3 row 23)', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    const before = await provider.libraryList('songs')
    await provider.ratingSet(track, { love: 'love' })
    const after = await provider.libraryList('songs')

    // Loving a track must not change library membership. If Love were mapped
    // to Save, the library page count would move here.
    expect(after.total).toBe(before.total)
  })

  test('libraryRemove takes a song out and Love does not put it back', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    const before = await provider.libraryList('songs')
    await provider.libraryRemove(track)
    const removed = await provider.libraryList('songs')
    expect(removed.total).toBe((before.total ?? 0) - 1)

    await provider.ratingSet(track, { love: 'love' })
    const afterLove = await provider.libraryList('songs')
    expect(afterLove.total).toBe(removed.total)
  })

  test('pages the library and reports an exact total', async () => {
    const provider = createFixtureProvider()
    const seen: string[] = []
    let cursor: string | undefined
    let guard = 0
    do {
      const page = await provider.libraryList('songs', cursor)
      seen.push(...page.items.map((i) => i.key))
      cursor = page.next ?? undefined
      guard += 1
    } while (cursor !== undefined && guard < 20)

    expect(seen).toHaveLength(provider.catalog.tracks.length)
    expect(new Set(seen).size).toBe(seen.length)
  })

  test('search normalises the way the re-resolution ladder does', async () => {
    const provider = createFixtureProvider()
    const results = await provider.search({ term: 'DONT STOP', scope: 'library', kinds: ['track'] })
    expect(results.tracks.map((t) => t.title)).toContain("Don't Stop")
  })

  test('an empty catalogue is a supported state, for §11.6', async () => {
    const empty = createFixtureProvider({
      catalog: {
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
        stations: [],
        genres: [],
        composers: [],
        tracksByAlbum: new Map(),
        tracksByPlaylist: new Map(),
      },
    })
    const page = await empty.libraryList('songs')
    expect(page.items).toHaveLength(0)
    expect(page.total).toBe(0)
    expect(page.next).toBeNull()
  })

  test('unsubscribing is idempotent', () => {
    const provider = createFixtureProvider()
    const off = provider.onPlaybackChange(() => {})
    off()
    expect(() => {
      off()
    }).not.toThrow()
  })
})
