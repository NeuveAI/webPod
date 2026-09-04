import type { FixtureProvider } from '@webpod/providers'
import {
  startAnnouncer,
  startNowPlayingVolumeFeedback,
  type DeviceStore,
} from '@webpod/state'

import type { RgbSample } from './model'

export interface ArtworkSamples {
  readonly dominant: readonly RgbSample[]
  readonly luminance: readonly RgbSample[]
}

export interface PlaybackClockHost {
  now(): number
  setInterval(callback: () => void, intervalMs: number): number
  clearInterval(handle: number): void
}

export interface StableSelectionHost {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

interface StableSelectionLease {
  readonly key: string
  readonly leases: Set<symbol>
  readonly abort: AbortController
  readonly handle: unknown
}

interface ClockLease {
  references: number
  readonly releaseClock: () => void
}

interface AnnouncerLease {
  references: number
  readonly stop: () => void
}

interface VolumeFeedbackLease {
  references: number
  readonly stop: () => void
}

export type AnnouncerStarter = (store: DeviceStore) => () => void
export type VolumeFeedbackStarter = (store: DeviceStore) => () => void

const playbackClocks = new WeakMap<object, ClockLease>()
const announcers = new WeakMap<object, AnnouncerLease>()
const volumeFeedbackDrivers = new WeakMap<object, VolumeFeedbackLease>()
const stableSelections = new WeakMap<object, StableSelectionLease>()

/**
 * Coalesces identical highlighted-row dwell work across the two colourways.
 * A changed selection or route cancels the old 700 ms intent. Work already
 * accepted by a provider may finish, so consumers must also honor the signal.
 */
export function acquireStableSelection(
  owner: object,
  key: string,
  task: (signal: AbortSignal) => void | Promise<void>,
  host: StableSelectionHost = {
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
  },
): () => void {
  const token = Symbol(key)
  const existing = stableSelections.get(owner)
  if (existing?.key === key) {
    existing.leases.add(token)
    return () => releaseStableSelection(owner, existing, token, host)
  }
  if (existing !== undefined) cancelStableSelection(owner, existing, host)
  const abort = new AbortController()
  const lease: StableSelectionLease = {
    key,
    leases: new Set([token]),
    abort,
    handle: host.setTimeout(() => {
      if (abort.signal.aborted || stableSelections.get(owner) !== lease) return
      void Promise.resolve(task(abort.signal)).catch(() => undefined)
    }, 700),
  }
  stableSelections.set(owner, lease)
  return () => releaseStableSelection(owner, lease, token, host)
}

function releaseStableSelection(owner: object, lease: StableSelectionLease, token: symbol, host: StableSelectionHost): void {
  lease.leases.delete(token)
  if (lease.leases.size > 0 || stableSelections.get(owner) !== lease) return
  cancelStableSelection(owner, lease, host)
}

function cancelStableSelection(owner: object, lease: StableSelectionLease, host: StableSelectionHost): void {
  host.clearTimeout(lease.handle)
  lease.abort.abort()
  if (stableSelections.get(owner) === lease) stableSelections.delete(owner)
}

/**
 * Leases the singleton store's announcement timer across parallel colourways.
 *
 * Both preview panels render the same device store. Starting one driver per
 * panel would arm competing timers against that store, so the first mount
 * starts the driver and the final cleanup stops it. The injected starter is a
 * test seam; production always uses {@link startAnnouncer}.
 */
export function acquireAnnouncer(
  owner: object,
  store: DeviceStore,
  start: AnnouncerStarter = startAnnouncer,
): () => void {
  const existing = announcers.get(owner)
  if (existing !== undefined) {
    existing.references += 1
    return () => releaseAnnouncer(owner)
  }
  announcers.set(owner, { references: 1, stop: start(store) })
  return () => releaseAnnouncer(owner)
}

function releaseAnnouncer(owner: object): void {
  const lease = announcers.get(owner)
  if (lease === undefined) return
  lease.references -= 1
  if (lease.references > 0) return
  lease.stop()
  announcers.delete(owner)
}

/**
 * Leases the state-owned transient-volume timer across parallel colourways.
 * The first panel starts the single driver; the final cleanup cancels it.
 */
export function acquireNowPlayingVolumeFeedback(
  owner: object,
  store: DeviceStore,
  start: VolumeFeedbackStarter = startNowPlayingVolumeFeedback,
): () => void {
  const existing = volumeFeedbackDrivers.get(owner)
  if (existing !== undefined) {
    existing.references += 1
    return () => releaseNowPlayingVolumeFeedback(owner)
  }
  volumeFeedbackDrivers.set(owner, { references: 1, stop: start(store) })
  return () => releaseNowPlayingVolumeFeedback(owner)
}

function releaseNowPlayingVolumeFeedback(owner: object): void {
  const lease = volumeFeedbackDrivers.get(owner)
  if (lease === undefined) return
  lease.references -= 1
  if (lease.references > 0) return
  lease.stop()
  volumeFeedbackDrivers.delete(owner)
}

/**
 * Drives the timer-free fixture provider from one shared clock per document.
 * Every mounted colourway acquires a lease; the interval is cancelled when the
 * last panel unmounts, so Strict Mode and route teardown cannot leak a clock.
 */
export function acquirePlaybackClock(
  owner: object,
  provider: FixtureProvider,
  host: PlaybackClockHost,
): () => void {
  const existing = playbackClocks.get(owner)
  if (existing !== undefined) {
    existing.references += 1
    return () => releasePlaybackClock(owner)
  }
  let prior = host.now()
  const handle = host.setInterval(() => {
    const current = host.now()
    const elapsed = Math.max(0, current - prior)
    prior = current
    provider.tick(elapsed)
  }, 250)
  playbackClocks.set(owner, {
    references: 1,
    releaseClock: () => host.clearInterval(handle),
  })
  return () => releasePlaybackClock(owner)
}

function releasePlaybackClock(owner: object): void {
  const lease = playbackClocks.get(owner)
  if (lease === undefined) return
  lease.references -= 1
  if (lease.references > 0) return
  lease.releaseClock()
  playbackClocks.delete(owner)
}

/** Converts tightly packed RGBA pixels into the RGB samples used by §5.11. */
export function rgbSamplesFromRgba(pixels: Uint8Array): readonly RgbSample[] {
  if (pixels.length % 4 !== 0) throw new Error('RGBA sample data must contain complete pixels')
  return Array.from({ length: pixels.length / 4 }, (_, index) => {
    const offset = index * 4
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    if (red === undefined || green === undefined || blue === undefined) throw new Error('RGBA sample data ended unexpectedly')
    return [red, green, blue]
  })
}

/**
 * Fetches the provider's same-origin artwork and decodes exact 3×3 and 8×8
 * pixel samples without a canvas. The proxy URL is the same URL rendered by
 * the sharp `<img>`, so treatment and visible art cannot diverge.
 */
export async function sampleProviderArtwork(url: string, signal?: AbortSignal, priority?: 'high' | 'low' | 'auto'): Promise<ArtworkSamples> {
  const response = await fetch(url, { signal, ...(priority === undefined ? {} : { priority }) })
  if (!response.ok) throw new Error(`Artwork proxy returned ${response.status}`)
  const type = response.headers.get('content-type')?.split(';')[0]
  if (type === undefined || type.length === 0) throw new Error('Artwork proxy omitted its content type')
  const encoded = await response.arrayBuffer()
  signal?.throwIfAborted()
  if (typeof ImageDecoder !== 'undefined' && await ImageDecoder.isTypeSupported(type)) {
    try {
      const [dominant, luminance] = await Promise.all([
        decodeSamples(encoded.slice(0), type, 3),
        decodeSamples(encoded.slice(0), type, 8),
      ])
      return { dominant, luminance }
    } catch {
      signal?.throwIfAborted()
      // Chromium advertises JPEG support but can still reject Apple artwork
      // with EncodingError. Fall through to the browser's image-element
      // decoder using the already-fetched bytes; never fetch the URL again.
    }
  }
  return decodeElementArtworkSamples(encoded, type, signal)
}

async function decodeSamples(encoded: ArrayBuffer, type: string, size: 3 | 8): Promise<readonly RgbSample[]> {
  const decoder = new ImageDecoder({ data: encoded, type, desiredWidth: size, desiredHeight: size })
  try {
    const result = await decoder.decode({ completeFramesOnly: true })
    const pixels = new Uint8Array(size * size * 4)
    try {
      await result.image.copyTo(pixels, { format: 'RGBA' })
    } finally {
      result.image.close()
    }
    const samples = rgbSamplesFromRgba(pixels)
    if (samples.length !== size * size) throw new Error(`Artwork decoder returned ${samples.length} pixels for ${size}×${size}`)
    return samples
  } finally {
    decoder.close()
  }
}

async function decodeElementArtworkSamples(encoded: ArrayBuffer, type: string, signal?: AbortSignal): Promise<ArtworkSamples> {
  const objectUrl = URL.createObjectURL(new Blob([encoded], { type }))
  const image = new Image()
  image.src = objectUrl
  try {
    await image.decode()
    signal?.throwIfAborted()
    const frame = new VideoFrame(image, { timestamp: 0 })
    const pixels = new Uint8Array(frame.allocationSize({ format: 'RGBA' }))
    try {
      const layouts = await frame.copyTo(pixels, { format: 'RGBA' })
      const layout = layouts[0]
      if (layout === undefined) throw new Error('Artwork frame omitted its RGBA plane')
      const sample = (size: 3 | 8): readonly RgbSample[] => {
        const samples: RgbSample[] = []
        for (let row = 0; row < size; row += 1) {
          for (let column = 0; column < size; column += 1) {
            const x = Math.min(frame.displayWidth - 1, Math.floor(((column + 0.5) * frame.displayWidth) / size))
            const y = Math.min(frame.displayHeight - 1, Math.floor(((row + 0.5) * frame.displayHeight) / size))
            const offset = layout.offset + y * layout.stride + x * 4
            const red = pixels[offset]
            const green = pixels[offset + 1]
            const blue = pixels[offset + 2]
            if (red === undefined || green === undefined || blue === undefined) throw new Error('Artwork frame ended before its sample point')
            samples.push([red, green, blue])
          }
        }
        return samples
      }
      return { dominant: sample(3), luminance: sample(8) }
    } finally {
      frame.close()
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
