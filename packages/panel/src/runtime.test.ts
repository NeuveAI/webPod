import { describe, expect, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'
import { createDeviceStore } from '@webpod/state/testing'

import { acquireAnnouncer, acquireNowPlayingVolumeFeedback, acquirePlaybackClock, acquireStableSelection, rgbSamplesFromRgba, sampleProviderArtwork, type PlaybackClockHost, type StableSelectionHost } from './runtime'

function fakeTimeoutHost() {
  let now = 0
  let sequence = 0
  const timers = new Map<number, { readonly due: number; readonly callback: () => void }>()
  const host: StableSelectionHost = {
    setTimeout(callback, delayMs) {
      const id = ++sequence
      timers.set(id, { due: now + delayMs, callback })
      return id
    },
    clearTimeout(handle) { timers.delete(handle as number) },
  }
  return {
    host,
    advance(milliseconds: number) {
      now += milliseconds
      const due = [...timers.entries()].filter(([, timer]) => timer.due <= now).sort((left, right) => left[1].due - right[1].due)
      for (const [id, timer] of due) {
        if (!timers.delete(id)) continue
        timer.callback()
      }
    },
  }
}

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

  test('parallel colourways lease exactly one transient-volume timer', () => {
    const store = createDeviceStore()
    const owner = {}
    let starts = 0
    let stops = 0
    const start = () => {
      starts += 1
      return () => { stops += 1 }
    }

    const releaseDark = acquireNowPlayingVolumeFeedback(owner, store, start)
    const releaseLight = acquireNowPlayingVolumeFeedback(owner, store, start)
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

  test('falls back to the already-fetched artwork bytes when ImageDecoder rejects a supported JPEG', async () => {
    const originals = new Map<PropertyKey, PropertyDescriptor | undefined>()
    for (const key of ['fetch', 'ImageDecoder', 'Image', 'VideoFrame'] as const) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    const createObjectUrl = URL.createObjectURL
    const revokeObjectUrl = URL.revokeObjectURL
    let fetches = 0
    let objectUrls = 0
    let revocations = 0
    try {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => {
        fetches += 1
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
      } })
      Object.defineProperty(globalThis, 'ImageDecoder', { configurable: true, value: class {
        static async isTypeSupported() { return true }
        async decode() { throw new DOMException('decode failed', 'EncodingError') }
        close() {}
      } })
      Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
        src = ''
        async decode() {}
      } })
      Object.defineProperty(globalThis, 'VideoFrame', { configurable: true, value: class {
        readonly displayWidth = 8
        readonly displayHeight = 8
        allocationSize() { return 8 * 8 * 4 }
        async copyTo(destination: Uint8Array) {
          for (let index = 0; index < 64; index += 1) {
            destination[index * 4] = index
            destination[index * 4 + 1] = 100
            destination[index * 4 + 2] = 200
            destination[index * 4 + 3] = 255
          }
          return [{ offset: 0, stride: 8 * 4 }]
        }
        close() {}
      } })
      URL.createObjectURL = () => { objectUrls += 1; return 'blob:test-artwork' }
      URL.revokeObjectURL = () => { revocations += 1 }

      const samples = await sampleProviderArtwork('/artwork', undefined, 'low')

      expect(fetches).toBe(1)
      expect(objectUrls).toBe(1)
      expect(revocations).toBe(1)
      expect(samples.dominant).toHaveLength(9)
      expect(samples.luminance).toHaveLength(64)
      expect(samples.luminance[0]).toEqual([0, 100, 200])
    } finally {
      URL.createObjectURL = createObjectUrl
      URL.revokeObjectURL = revokeObjectUrl
      for (const [key, descriptor] of originals) {
        if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
        else Object.defineProperty(globalThis, key, descriptor)
      }
    }
  })

  test('stable selection starts work at 700 ms, never at 699 ms', async () => {
    const owner = {}
    const clock = fakeTimeoutHost()
    let starts = 0
    const release = acquireStableSelection(owner, 'songs:a:0', () => { starts += 1 }, clock.host)

    clock.advance(699)
    await Promise.resolve()
    expect(starts).toBe(0)
    clock.advance(1)
    await Promise.resolve()
    expect(starts).toBe(1)
    release()
  })

  test('selection changes cancel stale dwell and coalesce identical colourway leases', async () => {
    const owner = {}
    const clock = fakeTimeoutHost()
    const starts: string[] = []
    const releaseFirst = acquireStableSelection(owner, 'songs:a:0', () => { starts.push('first') }, clock.host)
    const releaseDuplicate = acquireStableSelection(owner, 'songs:a:0', () => { starts.push('duplicate') }, clock.host)
    clock.advance(400)
    const releaseSecond = acquireStableSelection(owner, 'songs:b:1', () => { starts.push('second') }, clock.host)

    clock.advance(699)
    await Promise.resolve()
    expect(starts).toEqual([])
    clock.advance(1)
    await Promise.resolve()
    expect(starts).toEqual(['second'])
    releaseFirst()
    releaseDuplicate()
    releaseSecond()
  })

  test('route changes abort in-flight dwell work and clean up its timer', async () => {
    const owner = {}
    const clock = fakeTimeoutHost()
    const observed: { signal: AbortSignal | null } = { signal: null }
    const release = acquireStableSelection(owner, 'album-tracks:a:0', (signal) => { observed.signal = signal }, clock.host)
    clock.advance(700)
    await Promise.resolve()
    expect(observed.signal?.aborted).toBe(false)

    const releaseNextRoute = acquireStableSelection(owner, 'root:albums:0', () => {}, clock.host)
    expect(observed.signal?.aborted).toBe(true)
    release()
    releaseNextRoute()
  })
})
