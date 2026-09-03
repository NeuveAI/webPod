import { describe, expect, test } from 'bun:test'

import { CAPABILITIES } from '../capability.ts'
import type { Capability } from '../capability.ts'
import { APPLE_SUPPORTS } from '../apple/matrix.ts'
import { CapabilityUnsupportedError, InvalidCursorError } from '../errors.ts'
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

  test('every track has a unique, well-formed ISRC', () => {
    // ISRC is the top rung of §14.5's re-resolution ladder, so a duplicate in
    // the fixture would make a matching test pass for the wrong reason.
    const catalog = createFixtureCatalog()
    const isrcs = catalog.tracks.map((t) => t.isrc ?? '')
    expect(new Set(isrcs).size).toBe(isrcs.length)
    for (const isrc of isrcs) expect(isrc).toMatch(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
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

  test('Save is add-to-library, and the change is observable (§14.3 row 24)', async () => {
    // The other half of the pair above. Asserting only that Love ≠ Save is
    // satisfied by a `saveToggle` that does nothing at all — which is what it
    // did: it wrote a set no code in any package ever read, so a `Save` control
    // wired to it changed nothing and could not be read back.
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    await provider.libraryRemove(track)
    const removed = await provider.libraryList('songs')

    await provider.saveToggle(track, true)
    const saved = await provider.libraryList('songs')
    expect(saved.total).toBe((removed.total ?? 0) + 1)

    await provider.saveToggle(track, false)
    const unsaved = await provider.libraryList('songs')
    expect(unsaved.total).toBe(removed.total)
  })

  test('Save writes the same store as libraryAdd — one operation, two labels', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    await provider.libraryRemove(track)
    const removed = (await provider.libraryList('songs')).total ?? 0

    await provider.libraryAdd(track)
    const afterAdd = (await provider.libraryList('songs')).total ?? 0
    await provider.saveToggle(track, true)
    const afterSave = (await provider.libraryList('songs')).total ?? 0

    expect(afterAdd).toBe(removed + 1)
    // Saving an already-added track is a no-op, not a second copy: they are the
    // same membership, not two stores that happen to agree.
    expect(afterSave).toBe(afterAdd)
  })

  test('un-saving needs libraryRemove, which Apple does not have (§14.3 row 7)', async () => {
    const apple = createFixtureProvider({ supports: APPLE_SUPPORTS })
    const track = apple.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    // Saving works on Apple; un-saving is a library removal, and there is no
    // endpoint for it. The fixture must not be able to do what the launch
    // provider cannot, or the gap stops being visible.
    await apple.saveToggle(track, true)

    let thrown: unknown = null
    await apple.saveToggle(track, false).catch((error: unknown) => {
      thrown = error
    })
    expect(thrown).toBeInstanceOf(CapabilityUnsupportedError)
    expect((thrown as CapabilityUnsupportedError).capability).toBe('libraryRemove')
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

  test.each(['not-a-cursor', '-5', '25abc', ' 25', '', '1e3', '99999'])(
    'a cursor of %p is refused rather than answered with page 0',
    async (cursor) => {
      // Returning the first page with a non-null `next` is indistinguishable
      // from a legitimate first page, so a UI appending on a stale cursor
      // duplicates rows and never sees an error.
      const provider = createFixtureProvider()
      let thrown: unknown = null
      await provider.libraryList('songs', cursor).catch((error: unknown) => {
        thrown = error
      })
      expect(thrown).toBeInstanceOf(InvalidCursorError)
      expect((thrown as InvalidCursorError)._tag).toBe('InvalidCursor')
    },
  )

  test('a cursor this provider issued is accepted', async () => {
    const provider = createFixtureProvider()
    const first = await provider.libraryList('songs')
    expect(first.next).not.toBeNull()
    const second = await provider.libraryList('songs', first.next ?? undefined)
    expect(second.items.length).toBeGreaterThan(0)
    expect(second.items[0]?.key).not.toBe(first.items[0]?.key)
  })

  test('search normalises the way the re-resolution ladder does', async () => {
    const provider = createFixtureProvider()
    const results = await provider.search({ term: 'DONT STOP', scope: 'library', kinds: ['track'] })
    expect(results.tracks.map((t) => t.title)).toContain("Don't Stop")
  })

  test('library search excludes a removed track while catalogue search still finds it', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('empty fixture catalogue')

    await provider.libraryRemove(track)
    const query = { term: track.title, kinds: ['track'] as const }
    const library = await provider.search({ ...query, scope: 'library' })
    const catalog = await provider.search({ ...query, scope: 'catalog' })

    expect(library.tracks.some((candidate) => candidate.key === track.key)).toBe(false)
    expect(catalog.tracks.some((candidate) => candidate.key === track.key)).toBe(true)
  })

  test('search cursor advances through all matches without repeating the first page', async () => {
    const provider = createFixtureProvider()
    const first = await provider.search({ term: '', scope: 'catalog', kinds: ['track'], limit: 10 })
    expect(first.tracks).toHaveLength(10)
    expect(first.next).toBe('10')

    const second = await provider.search({
      term: '',
      scope: 'catalog',
      kinds: ['track'],
      limit: 10,
      cursor: first.next ?? undefined,
    })
    expect(second.tracks).toHaveLength(10)
    expect(second.tracks[0]?.key).not.toBe(first.tracks[0]?.key)
    expect(new Set([...first.tracks, ...second.tracks].map((track) => track.key)).size).toBe(20)
    expect(second.next).toBe('20')
  })

  test('search limit caps the whole grouped result rather than every requested kind', async () => {
    const provider = createFixtureProvider()
    const result = await provider.search({
      term: '',
      scope: 'catalog',
      kinds: ['track', 'album', 'artist', 'playlist', 'station'],
      limit: 10,
    })
    const count =
      result.tracks.length +
      result.albums.length +
      result.artists.length +
      result.playlists.length +
      result.stations.length
    expect(count).toBe(10)
    expect(result.next).toBe('10')
  })

  test.each(['not-a-cursor', '-1', '1e2', '99999'])(
    'search refuses malformed or unissued cursor %p',
    async (cursor) => {
      const provider = createFixtureProvider()
      let thrown: unknown = null
      await provider
        .search({ term: '', scope: 'catalog', kinds: ['track'], cursor })
        .catch((error: unknown) => {
          thrown = error
        })
      expect(thrown).toBeInstanceOf(InvalidCursorError)
    },
  )

  test('album membership changes the album slice and never the songs slice', async () => {
    const provider = createFixtureProvider()
    const album = provider.catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')
    const songsBefore = (await provider.libraryList('songs')).total
    const albumsBefore = (await provider.libraryList('albums')).total

    await provider.libraryRemove(album)
    expect((await provider.libraryList('albums')).total).toBe((albumsBefore ?? 0) - 1)
    expect((await provider.libraryList('songs')).total).toBe(songsBefore)

    await provider.libraryAdd(album)
    expect((await provider.libraryList('albums')).total).toBe(albumsBefore)
    expect((await provider.libraryList('songs')).total).toBe(songsBefore)
  })

  test('playlist membership changes the playlist slice and is idempotent', async () => {
    const provider = createFixtureProvider()
    const playlist = provider.catalog.playlists[0]
    if (playlist === undefined) throw new Error('empty fixture catalogue')
    const before = (await provider.libraryList('playlists')).total

    await provider.libraryRemove(playlist)
    expect((await provider.libraryList('playlists')).total).toBe((before ?? 0) - 1)
    await provider.libraryAdd(playlist)
    await provider.libraryAdd(playlist)
    expect((await provider.libraryList('playlists')).total).toBe(before)
  })

  test('album and playlist membership drive library-scoped search', async () => {
    const provider = createFixtureProvider()
    const album = provider.catalog.albums[0]
    const playlist = provider.catalog.playlists[0]
    if (album === undefined || playlist === undefined) throw new Error('empty fixture catalogue')

    await provider.libraryRemove(album)
    await provider.libraryRemove(playlist)
    const albums = await provider.search({ term: album.title, scope: 'library', kinds: ['album'] })
    const playlists = await provider.search({ term: playlist.name, scope: 'library', kinds: ['playlist'] })
    expect(albums.albums.some((candidate) => candidate.key === album.key)).toBe(false)
    expect(playlists.playlists.some((candidate) => candidate.key === playlist.key)).toBe(false)

    await provider.libraryAdd(album)
    await provider.libraryAdd(playlist)
    const restoredAlbums = await provider.search({ term: album.title, scope: 'library', kinds: ['album'] })
    const restoredPlaylists = await provider.search({ term: playlist.name, scope: 'library', kinds: ['playlist'] })
    expect(restoredAlbums.albums.some((candidate) => candidate.key === album.key)).toBe(true)
    expect(restoredPlaylists.playlists.some((candidate) => candidate.key === playlist.key)).toBe(true)
  })

  test('artist list and library search share membership through remove and both add paths', async () => {
    const provider = createFixtureProvider()
    const artist = provider.catalog.artists[0]
    if (artist === undefined) throw new Error('empty fixture catalogue')
    const albums = provider.catalog.albums.filter((album) => album.artistName === artist.name)
    const tracks = provider.catalog.tracks.filter((track) => track.artistName === artist.name)
    if (albums.length === 0 || tracks.length === 0) throw new Error('fixture artist has no music')

    const listed = async (): Promise<boolean> =>
      (await provider.libraryList('artists')).items.some((candidate) => candidate.key === artist.key)
    const searched = async (): Promise<boolean> =>
      (
        await provider.search({ term: artist.name, scope: 'library', kinds: ['artist'] })
      ).artists.some((candidate) => candidate.key === artist.key)

    expect(await listed()).toBe(true)
    expect(await searched()).toBe(true)
    for (const track of tracks) await provider.libraryRemove(track)
    for (const album of albums) await provider.libraryRemove(album)
    expect(await listed()).toBe(false)
    expect(await searched()).toBe(false)

    const track = tracks[0]
    const album = albums[0]
    if (track === undefined || album === undefined) throw new Error('fixture artist has no restorable music')
    await provider.libraryAdd(track)
    expect(await listed()).toBe(true)
    expect(await searched()).toBe(true)
    await provider.libraryRemove(track)
    expect(await listed()).toBe(false)
    expect(await searched()).toBe(false)
    await provider.libraryAdd(album)
    expect(await listed()).toBe(true)
    expect(await searched()).toBe(true)
  })

  test('genre and composer library facets follow saved tracks and albums', async () => {
    const provider = createFixtureProvider()
    const album = provider.catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')
    const tracks = provider.catalog.tracksByAlbum.get(album.key) ?? []
    const genre = provider.catalog.genreByAlbum.get(album.key)
    const composer = provider.catalog.composerByAlbum.get(album.key)
    if (genre === undefined || composer === undefined) throw new Error('fixture album has no facets')

    for (const track of tracks) await provider.libraryRemove(track)
    await provider.libraryRemove(album)
    expect((await provider.libraryList('genres')).items.some((candidate) => candidate.key === genre.key)).toBe(false)
    expect((await provider.libraryList('composers')).items.some((candidate) => candidate.key === composer.key)).toBe(
      false,
    )

    const track = tracks[0]
    if (track === undefined) throw new Error('fixture album has no tracks')
    await provider.libraryAdd(track)
    expect((await provider.libraryList('genres')).items.some((candidate) => candidate.key === genre.key)).toBe(true)
    expect((await provider.libraryList('composers')).items.some((candidate) => candidate.key === composer.key)).toBe(
      true,
    )

    await provider.libraryRemove(track)
    await provider.libraryAdd(album)
    expect((await provider.libraryList('genres')).items.some((candidate) => candidate.key === genre.key)).toBe(true)
    expect((await provider.libraryList('composers')).items.some((candidate) => candidate.key === composer.key)).toBe(
      true,
    )
  })

  test('playlist writes publish the updated trackCount on subsequent reads', async () => {
    const provider = createFixtureProvider()
    const playlist = provider.catalog.playlists[0]
    const track = provider.catalog.tracks[0]
    if (playlist === undefined || track === undefined) throw new Error('empty fixture catalogue')

    await provider.playlistAddTracks(playlist, [track])
    const afterAdd = await provider.libraryList('playlists')
    const added = afterAdd.items.find((candidate) => candidate.key === playlist.key)
    expect(added?.kind).toBe('playlist')
    expect(added?.kind === 'playlist' ? added.trackCount : null).toBe(playlist.trackCount + 1)

    await provider.play({ kind: 'playlist', playlist })
    const queueAfterAdd = await provider.queueRead()
    expect(1 + queueAfterAdd.next.length).toBe(playlist.trackCount + 1)

    await provider.playlistRemoveTracks(playlist, [0, 1])
    const afterRemove = await provider.libraryList('playlists')
    const removed = afterRemove.items.find((candidate) => candidate.key === playlist.key)
    expect(removed?.kind === 'playlist' ? removed.trackCount : null).toBe(playlist.trackCount - 1)
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
        genreByAlbum: new Map(),
        composerByAlbum: new Map(),
        tracksByPlaylist: new Map(),
      },
    })
    const page = await empty.libraryList('songs')
    expect(page.items).toHaveLength(0)
    expect(page.total).toBe(0)
    expect(page.next).toBeNull()
  })

  test('starting a station starts fixture playback exactly once', async () => {
    const provider = createFixtureProvider()
    const station = provider.catalog.stations[0]
    if (station === undefined) throw new Error('empty fixture station catalogue')
    let playingTransitions = 0
    const off = provider.onPlaybackChange((state) => { if (state.status === 'playing') playingTransitions += 1 })
    await provider.stationStart({ type: 'station', ref: station.catalogId })
    off()
    expect(provider.playback.status).toBe('playing')
    expect(playingTransitions).toBe(1)
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
