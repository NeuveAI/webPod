import type { FixtureProvider } from '@webpod/providers'

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

interface ClockLease {
  references: number
  readonly releaseClock: () => void
}

const playbackClocks = new WeakMap<object, ClockLease>()

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
export async function sampleProviderArtwork(url: string, signal?: AbortSignal): Promise<ArtworkSamples> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Artwork proxy returned ${response.status}`)
  const type = response.headers.get('content-type')?.split(';')[0]
  if (type === undefined || type.length === 0) throw new Error('Artwork proxy omitted its content type')
  const encoded = await response.arrayBuffer()
  const [dominant, luminance] = await Promise.all([
    decodeSamples(encoded.slice(0), type, 3, url),
    decodeSamples(encoded.slice(0), type, 8, url),
  ])
  return { dominant, luminance }
}

async function decodeSamples(encoded: ArrayBuffer, type: string, size: 3 | 8, url: string): Promise<readonly RgbSample[]> {
  if (typeof ImageDecoder === 'undefined' || !(await ImageDecoder.isTypeSupported(type))) return decodeElementSamples(url, size)
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

async function decodeElementSamples(url: string, size: 3 | 8): Promise<readonly RgbSample[]> {
  const image = new Image()
  image.src = url
  await image.decode()
  const frame = new VideoFrame(image, { timestamp: 0 })
  try {
    const pixels = new Uint8Array(frame.allocationSize({ format: 'RGBA' }))
    const layouts = await frame.copyTo(pixels, { format: 'RGBA' })
    const layout = layouts[0]
    if (layout === undefined) throw new Error('Artwork frame omitted its RGBA plane')
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
  } finally {
    frame.close()
  }
}
