import { describe, expect, test } from 'bun:test'
import { APPLE_SUPPORTS, createFixtureProvider, mintLocalKey, type MusicProvider, type TrackRef } from '@webpod/providers'
import { createProgressiveAppleSource, quiesceMusicProvider, resolveMusicRuntimeMode } from './music-runtime'

describe('music runtime selection', () => {
  test('production is Apple-only regardless of stale query or build flags', () => {
    expect(resolveMusicRuntimeMode(null, undefined)).toBe('apple')
    expect(resolveMusicRuntimeMode(null, 'apple')).toBe('apple')
    expect(resolveMusicRuntimeMode('fixture', 'apple')).toBe('apple')
    expect(resolveMusicRuntimeMode('apple', undefined)).toBe('apple')
    expect(resolveMusicRuntimeMode('other', 'apple')).toBe('apple')
  })

  test('quiesces an authorized transport before its controls leave the screen', async () => {
    const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
    let pauses = 0
    const provider: MusicProvider = {
      ...base,
      async pause() { pauses += 1 },
    }

    await quiesceMusicProvider(provider)
    expect(pauses).toBe(1)
  })

  test('unlocks after one page per collection and streams later pages into the same source', async () => {
    const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
    const [firstSong, secondSong] = base.catalog.tracks
    if (firstSong === undefined || secondSong === undefined) throw new Error('fixture songs missing')
    let releaseSecondPage: (() => void) | undefined
    const secondPageGate = new Promise<void>((resolve) => { releaseSecondPage = resolve })
    const provider: MusicProvider = {
      ...base,
      async libraryList(kind, cursor) {
        if (kind === 'songs') {
          if (cursor === undefined) return { items: [firstSong], next: 'songs-page-2', total: 2 }
          await secondPageGate
          return { items: [secondSong], next: null, total: 2 }
        }
        const items = kind === 'albums' ? base.catalog.albums : kind === 'artists' ? base.catalog.artists : kind === 'playlists' ? base.catalog.playlists : []
        return { items, next: null, total: items.length }
      },
      async stationsList() { return [] },
    }

    const { source, completion } = await createProgressiveAppleSource(provider)
    let notifications = 0
    source.subscribe?.(() => { notifications += 1 })

    expect(source.songs).toEqual([firstSong])
    expect(source.libraryStatus?.songs).toEqual({ loaded: 1, state: 'loading' })
    releaseSecondPage?.()
    await completion
    expect(source.songs).toEqual([firstSong, secondSong])
    expect(source.libraryStatus?.songs).toEqual({ loaded: 2, state: 'complete' })
    expect(notifications).toBeGreaterThan(0)
  })

  for (const result of ['empty', 'error', 'pending'] as const) {
    test(`optional ${result} radio discovery preserves completed Apple library loading`, async () => {
      const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
      let calls = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => { release = resolve })
      const provider: MusicProvider = {
        ...base,
        async stationsList() {
          calls++
          if (result === 'error') throw new Error('Synthetic radio unavailable')
          if (result === 'pending') await gate
          return []
        },
      }
      const { source, completion } = await createProgressiveAppleSource(provider)
      await completion
      expect(calls).toBe(1)
      expect(source.songs.length).toBeGreaterThan(0)
      expect(source.libraryStatus?.songs.state).toBe('complete')
      expect(source.stations).toEqual([])
      release?.()
    })
  }

  test('bounds relationship and search track identity memory', async () => {
    const provider = createFixtureProvider({ supports: APPLE_SUPPORTS })
    const { source, completion } = await createProgressiveAppleSource(provider)
    await completion
    const seed = provider.catalog.tracks[0]
    if (seed === undefined) throw new Error('fixture song missing')
    const remembered: TrackRef[] = Array.from({ length: 300 }, (_, index) => ({
      ...seed,
      key: mintLocalKey(),
      catalogId: `remembered.${String(index)}`,
    }))

    source.rememberTracks?.(remembered)

    expect(source.trackByKey(remembered[0]?.key ?? seed.key)).toBeNull()
    expect(source.trackByKey(remembered.at(-1)?.key ?? seed.key)?.catalogId).toBe('remembered.299')
  })
})
