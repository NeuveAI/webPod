import { expect, test } from 'bun:test'
import { createFixtureProvider, mintLocalKey, type AlbumRef, type ArtistRef, type MusicProvider, type TrackRef, type RelationshipPageOptions } from '@webpod/providers'
import { createProgressiveMusicSource } from './library'

function setup(counts = [20, 8, 8, 8, 8, 4]) {
  const artist: ArtistRef = { kind: 'artist', key: mintLocalKey(), provider: 'fixture', catalogId: 'artist', name: 'Artist' }
  const albums: AlbumRef[] = counts.map((count, index) => ({ kind: 'album', key: mintLocalKey(), provider: 'fixture', catalogId: String(index), title: `Album ${index}`, artistName: 'Artist', trackCount: count }))
  const tracks: TrackRef[][] = counts.map((count, album) => Array.from({ length: count }, (_, index) => ({ kind: 'track', key: mintLocalKey(), provider: 'fixture', catalogId: `${album}.${index}`, title: `${album}.${index}`, artistName: 'Artist', durationMs: 1000, playable: true })))
  const calls: { kind: string; id: string; offset: number; limit: number }[] = []
  const page = <T>(items: readonly T[], options: RelationshipPageOptions) => {
    const offset = Number(options.cursor ?? 0)
    return { items: items.slice(offset, offset + options.limit), next: offset + options.limit < items.length ? String(offset + options.limit) : null, total: items.length }
  }
  const provider: MusicProvider = {
    ...createFixtureProvider(),
    libraryList: async (kind) => ({ items: kind === 'artists' ? [artist] : kind === 'albums' ? albums : [], next: null, total: null }),
    relatedAlbumsPage: async (_ref, options) => { calls.push({ kind: 'albums', id: artist.catalogId, offset: Number(options.cursor ?? 0), limit: options.limit }); return page(albums, options) },
    relatedTracksPage: async (ref, options) => { calls.push({ kind: 'tracks', id: ref.catalogId, offset: Number(options.cursor ?? 0), limit: options.limit }); return page(tracks[Number(ref.catalogId)] ?? [], options) },
  }
  return { provider, artist, albums, tracks, calls, page }
}

test('artist warmup samples 5×5 and exposes an actual contiguous15, navigation resumes to all', async () => {
  const fixture = setup()
  const { source } = await createProgressiveMusicSource(fixture.provider)
  await source.prefetchArtist?.(fixture.artist.key)
  const trackCalls = fixture.calls.filter((call) => call.kind === 'tracks')
  expect(trackCalls.slice(0, 5).map((call) => [call.id, call.offset, call.limit])).toEqual(['0', '1', '2', '3', '4'].map((id) => [id, 0, 5]))
  expect(trackCalls.slice(5)).toEqual([{ kind: 'tracks', id: '0', offset: 5, limit: 10 }])
  expect(source.tracksSnapshot?.('artist', fixture.artist.key)?.map((track) => track.title)).toEqual(fixture.tracks[0]?.slice(0, 15).map((track) => track.title))
  const complete = await source.tracksForArtist?.(fixture.artist.key)
  expect(complete?.map((track) => track.title)).toEqual(fixture.tracks.flat().map((track) => track.title))
  expect(fixture.calls.filter((call) => call.kind === 'tracks' && call.id === '0' && call.offset === 0)).toHaveLength(1)
})

test('sparse and empty albums cross album pages without missing middle songs', async () => {
  const fixture = setup([0, 1, 0, 2, 1, 0, 3, 4, 1, 0, 3, 5, 0, 2, 1, 1, 8])
  const { source } = await createProgressiveMusicSource(fixture.provider)
  await source.prefetchArtist?.(fixture.artist.key)
  expect(source.tracksSnapshot?.('artist', fixture.artist.key)?.map((track) => track.title)).toEqual(fixture.tracks.flat().slice(0, 15).map((track) => track.title))
  expect((await source.tracksForArtist?.(fixture.artist.key))?.map((track) => track.title)).toEqual(fixture.tracks.flat().map((track) => track.title))
})

test('a genuine direct artist relationship warms30; current Apple/Spotify never declare it', async () => {
  const fixture = setup([40])
  const directCalls: number[] = []
  fixture.provider.artistTracksPage = async (_artist, options) => { directCalls.push(options.limit); return fixture.page(fixture.tracks.flat(), options) }
  const { source } = await createProgressiveMusicSource(fixture.provider)
  await source.prefetchArtist?.(fixture.artist.key)
  expect(directCalls).toEqual([30])
  expect(source.tracksSnapshot?.('artist', fixture.artist.key)).toHaveLength(30)
  expect(await source.tracksForArtist?.(fixture.artist.key)).toHaveLength(40)
})

test('album concurrent warm/navigation reuses pages; errors retain prefix and retry only on accepted navigation', async () => {
  const fixture = setup([40])
  const read = fixture.provider.relatedTracksPage
  if (read === undefined) throw new Error('missing fixture page')
  let failures = 0
  fixture.provider.relatedTracksPage = async (ref, options) => {
    if (options.cursor === '15' && failures++ === 0) throw new Error('offline')
    return read(ref, options)
  }
  const { source } = await createProgressiveMusicSource(fixture.provider)
  const album = fixture.albums[0]
  if (album === undefined) throw new Error('missing album')
  await Promise.all([source.tracksForAlbum(album.key, { priority: 'low', limit: 15 }), source.tracksForAlbum(album.key, { priority: 'low', limit: 15 })])
  expect(fixture.calls.filter((call) => call.kind === 'tracks')).toHaveLength(1)
  await expect(Promise.resolve(source.tracksForAlbum(album.key))).rejects.toThrow('offline')
  expect(source.tracksSnapshot?.('album', album.key)).toHaveLength(15)
  expect(source.tracksFailed?.('album', album.key)).toBe(true)
  await source.tracksForAlbum(album.key, { priority: 'low', limit: 30 })
  expect(failures).toBe(1)
  expect(await source.tracksForAlbum(album.key)).toHaveLength(40)
  expect(source.tracksFailed?.('album', album.key)).toBe(false)
})

test('source replacement prevents late publication and cache clear aborts pagination', async () => {
  const fixture = setup([20])
  let release: (() => void) | undefined
  const pending = new Promise<void>((resolve) => { release = resolve })
  const original = fixture.provider.relatedTracksPage
  fixture.provider.relatedTracksPage = async (ref, options) => { await pending; if (original === undefined) throw new Error('missing page'); return original(ref, options) }
  let current = true
  const { source } = await createProgressiveMusicSource(fixture.provider, () => current)
  const album = fixture.albums[0]
  if (album === undefined) throw new Error('missing album')
  const work = Promise.resolve(source.tracksForAlbum(album.key, { priority: 'low', limit: 15 }))
  await Promise.resolve(); await Promise.resolve()
  current = false
  source.clearRelationships?.()
  release?.()
  await expect(work).rejects.toThrow()
  expect(source.tracksSnapshot?.('album', album.key)).toBeUndefined()
})

test('library publishes first15 then continuously grows root counts without entering categories', async () => {
  const fixture = setup(Array.from({ length: 40 }, () => 2))
  const calls: { kind: string; offset: number; limit: number; priority: string | undefined }[] = []
  fixture.provider.libraryList = async (kind, cursor, options) => {
    const items = kind === 'albums' ? fixture.albums : kind === 'artists' ? [fixture.artist] : kind === 'songs' ? fixture.tracks.flat() : []
    const offset = Number(cursor ?? 0)
    const limit = options?.limit ?? 50
    calls.push({ kind, offset, limit, priority: options?.priority })
    return { items: items.slice(offset, offset + limit), next: offset + limit < items.length ? String(offset + limit) : null, total: items.length }
  }
  const { source, completion } = await createProgressiveMusicSource(fixture.provider)
  expect(source.albums).toHaveLength(15)
  expect(source.songs).toHaveLength(15)
  expect(calls).toHaveLength(4)
  expect(calls.every((call) => call.limit === 15 && call.offset === 0)).toBe(true)
  const snapshots: number[] = []
  source.subscribe?.(() => { snapshots.push(source.songs.length) })
  await completion
  expect(source.albums).toHaveLength(40)
  expect(source.songs).toHaveLength(80)
  expect(source.libraryStatus?.albums.state).toBe('complete')
  expect(source.libraryStatus?.songs.state).toBe('complete')
  expect(snapshots).toContain(65)
  expect(snapshots.at(-1)).toBe(80)
  expect(calls.slice(4).map((call) => [call.kind, call.limit, call.priority])).toEqual([['albums', 50, 'low'], ['songs', 50, 'low'], ['songs', 50, 'low']])
})

test('All remains owned while traversing513 albums beyond the512-entry LFU bound', async () => {
  const fixture = setup(Array.from({ length: 513 }, () => 2))
  const { source } = await createProgressiveMusicSource(fixture.provider)
  expect((await source.tracksForArtist?.(fixture.artist.key))?.map((track) => track.title)).toEqual(fixture.tracks.flat().map((track) => track.title))
})

test('failed root continuation resumes from the last good cursor on reentry', async () => {
  const fixture = setup()
  let failed = false
  const cursors: (string | undefined)[] = []
  fixture.provider.libraryList = async (kind, cursor) => {
    if (kind !== 'albums') return { items: [], next: null, total: null }
    cursors.push(cursor)
    if (cursor === 'next' && !failed) { failed = true; throw new Error('offline') }
    return { items: cursor === undefined ? fixture.albums.slice(0, 1) : fixture.albums.slice(1), next: cursor === undefined ? 'next' : null, total: null }
  }
  const { source } = await createProgressiveMusicSource(fixture.provider)
  await source.ensureLibrary?.('albums')
  expect(source.libraryStatus?.albums.state).toBe('error')
  await source.ensureLibrary?.('albums')
  expect(source.libraryStatus?.albums.state).toBe('complete')
  expect(source.albums).toHaveLength(fixture.albums.length)
  expect(cursors).toEqual([undefined, 'next', 'next'])
})

test('navigating an initially complete collection cannot turn its status back to loading', async () => {
  const fixture = setup()
  const { source } = await createProgressiveMusicSource(fixture.provider)
  await source.ensureLibrary?.('albums')
  expect(source.libraryStatus?.albums.state).toBe('complete')
})

test('a rendered artist album ref still loads after its relationship cache retires', async () => {
  const fixture = setup([20])
  fixture.provider.libraryList = async (kind) => ({ items: kind === 'artists' ? [fixture.artist] : [], next: null, total: null })
  const { source } = await createProgressiveMusicSource(fixture.provider)
  const rendered = await source.albumsForArtist(fixture.artist.key)
  const album = rendered[0]
  if (album === undefined || source.tracksForAlbumRef === undefined) throw new Error('missing album')
  source.clearRelationships?.()
  expect(source.artistAlbumsSnapshot?.(fixture.artist.key)).toBeUndefined()
  expect(source.albums).toHaveLength(0)
  expect(await source.tracksForAlbumRef(album)).toHaveLength(20)
  expect(fixture.calls.filter((call) => call.kind === 'tracks')).toHaveLength(2)
})

test('foreground hydration bypasses a blocked background collection and joins its own pending page', async () => {
  const fixture = setup(Array.from({ length: 40 }, () => 1))
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { release = resolve })
  let started: (() => void) | undefined
  const backgroundStarted = new Promise<void>((resolve) => { started = resolve })
  const calls: string[] = []
  fixture.provider.libraryList = async (kind, cursor, options) => {
    const items = kind === 'albums' ? fixture.albums : kind === 'songs' ? fixture.tracks.flat() : []
    const offset = Number(cursor ?? 0); const limit = options?.limit ?? 50
    if (cursor !== undefined) calls.push(`${kind}:${cursor}:${options?.priority}`)
    if (kind === 'albums' && cursor !== undefined) { started?.(); await gate }
    return { items: items.slice(offset, offset + limit), next: offset + limit < items.length ? String(offset + limit) : null, total: items.length }
  }
  const { source, completion } = await createProgressiveMusicSource(fixture.provider)
  await backgroundStarted
  const acceptedAlbums = source.ensureLibrary?.('albums')
  await source.ensureLibrary?.('songs')
  expect(source.songs).toHaveLength(40)
  expect(source.albums).toHaveLength(15)
  expect(calls).toEqual(['albums:15:low', 'songs:15:high'])
  release?.()
  await Promise.all([completion, acceptedAlbums])
  expect(source.albums).toHaveLength(40)
  expect(calls.filter((call) => call.startsWith('albums:'))).toHaveLength(1)
})

test('continuous library hydration stops publishing and requesting after source retirement', async () => {
  const fixture = setup(Array.from({ length: 40 }, () => 1))
  let current = true
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { release = resolve })
  let started: (() => void) | undefined
  const backgroundStarted = new Promise<void>((resolve) => { started = resolve })
  const requests: string[] = []
  fixture.provider.libraryList = async (kind, cursor, options) => {
    const items = kind === 'albums' ? fixture.albums : kind === 'songs' ? fixture.tracks.flat() : []
    const offset = Number(cursor ?? 0); const limit = options?.limit ?? 50
    if (cursor !== undefined) { requests.push(kind); started?.(); await gate }
    return { items: items.slice(offset, offset + limit), next: offset + limit < items.length ? String(offset + limit) : null, total: items.length }
  }
  const { source, completion } = await createProgressiveMusicSource(fixture.provider, () => current)
  await backgroundStarted
  const revision = source.getRevision?.()
  current = false
  release?.()
  await completion
  expect(source.albums).toHaveLength(15)
  expect(source.songs).toHaveLength(15)
  expect(source.getRevision?.()).toBe(revision)
  expect(requests).toEqual(['albums'])
})

test('All completes oversized child albums without using evictable completion state', async () => {
  const fixture = setup([45])
  const { source } = await createProgressiveMusicSource(fixture.provider, () => true, { relationshipCache: { tracksMaxBytes: 1 } })
  const result = await source.tracksForArtist?.(fixture.artist.key)
  expect(result?.map((track) => track.title)).toEqual(fixture.tracks.flat().map((track) => track.title))
  expect(fixture.calls.filter((call) => call.kind === 'tracks').map((call) => call.offset)).toEqual([0, 15, 30])
  expect(source.tracksSnapshot?.('artist', fixture.artist.key)).toBeUndefined()
})

test('All prefix followed by complete navigation succeeds when each result exceeds the retention budget', async () => {
  const fixture = setup([45])
  const { source } = await createProgressiveMusicSource(fixture.provider, () => true, { relationshipCache: { tracksMaxBytes: 1 } })
  expect(await source.tracksForArtist?.(fixture.artist.key, { limit: 15 })).toHaveLength(15)
  expect(await source.tracksForArtist?.(fixture.artist.key)).toHaveLength(45)
  // The evicted initial prefix legitimately reloads once; each complete
  // request then consumes its owned album exactly once, never a refetch loop.
  expect(fixture.calls.filter((call) => call.kind === 'tracks').map((call) => call.offset)).toEqual([0, 0, 15, 30])
})
