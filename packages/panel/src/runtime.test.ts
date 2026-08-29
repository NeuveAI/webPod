import { describe, expect, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'
import { createDeviceStore } from '@webpod/state/testing'

import { acquireAnnouncer, acquirePlaybackClock, rgbSamplesFromRgba, type PlaybackClockHost } from './runtime'

describe('panel runtime', () => {
  test('parallel colourways lease exactly one announcement driver', () => {
    const store = createDeviceStore()
    const owner = {}
    let starts = 0
    let stops = 0
    const start = () => {
      starts += 1
      return () => { stops += 1 }
    }

    const releaseDark = acquireAnnouncer(owner, store, start)
    const releaseLight = acquireAnnouncer(owner, store, start)
    expect(starts).toBe(1)
    releaseDark()
    expect(stops).toBe(0)
    releaseLight()
    expect(stops).toBe(1)
  })

  test('one leased clock advances continuously and stops after final cleanup', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('fixture track missing')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    let now = 0
    let callback: (() => void) | null = null
    let clears = 0
    const host: PlaybackClockHost = {
      now: () => now,
      setInterval: (next) => { callback = next; return 41 },
      clearInterval: (handle) => { expect(handle).toBe(41); clears += 1 },
    }
    const owner = {}
    const releaseDark = acquirePlaybackClock(owner, provider, host)
    const releaseLight = acquirePlaybackClock(owner, provider, host)
    const fire = () => {
      const scheduled = callback
      if (scheduled === null) throw new Error('clock callback missing')
      scheduled()
    }
    now = 250
    fire()
    now = 900
    fire()
    expect(provider.playback.positionMs).toBe(900)
    releaseDark()
    expect(clears).toBe(0)
    now = 1_400
    fire()
    expect(provider.playback.positionMs).toBe(1_400)
    releaseLight()
    expect(clears).toBe(1)
  })

  test('RGBA conversion preserves every sampled pixel and rejects partial data', () => {
    expect(rgbSamplesFromRgba(new Uint8Array([1, 2, 3, 255, 10, 20, 30, 128]))).toEqual([[1, 2, 3], [10, 20, 30]])
    expect(() => rgbSamplesFromRgba(new Uint8Array([1, 2, 3]))).toThrow()
  })
})
