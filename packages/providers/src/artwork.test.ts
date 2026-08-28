import { describe, expect, test } from 'bun:test'

import { ARTWORK_PROXY_PATH, artworkUrl, TEMPLATE_ARTWORK_CEILING_PX } from './artwork.ts'
import { InvalidArtworkError } from './errors.ts'
import type { Artwork } from './identity.ts'

/** Apple: one template, any size substituted into it (§14.3 row 26). */
const APPLE: Artwork = {
  kind: 'template',
  template: 'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/{w}x{h}bb.jpg',
}

/** Spotify: three fixed sizes, the typical 640 / 300 / 64 (§14.3 row 26). */
const SPOTIFY: Artwork = {
  kind: 'fixed',
  sizes: [
    { url: 'https://i.scdn.co/image/640', w: 640, h: 640 },
    { url: 'https://i.scdn.co/image/300', w: 300, h: 300 },
    { url: 'https://i.scdn.co/image/64', w: 64, h: 64 },
  ],
}

/** The largest width the fixed source actually has. */
const SPOTIFY_NATIVE_MAX = 640

describe('artworkUrl — never upscales a sharp image (§14.3 row 26)', () => {
  test('S13 asks Spotify for 1400 and is told it got 640', () => {
    const { actualPx } = artworkUrl(SPOTIFY, 1400)
    expect(actualPx).toBe(SPOTIFY_NATIVE_MAX)
  })

  test('actualPx never exceeds the native source, at any request size', () => {
    // D01 desktop at 1.5x is §14.3's named risk case, so sweep past it rather
    // than asserting the one size the spec happens to mention.
    for (const px of [1, 32, 63, 64, 65, 300, 301, 639, 640, 641, 1400, 2100, 3000]) {
      const { actualPx } = artworkUrl(SPOTIFY, px)
      expect(actualPx).toBeLessThanOrEqual(SPOTIFY_NATIVE_MAX)
    }
  })

  test('picks the smallest size that still covers the request', () => {
    expect(artworkUrl(SPOTIFY, 64).actualPx).toBe(64)
    expect(artworkUrl(SPOTIFY, 65).actualPx).toBe(300)
    expect(artworkUrl(SPOTIFY, 300).actualPx).toBe(300)
    expect(artworkUrl(SPOTIFY, 301).actualPx).toBe(640)
  })

  test('never drops below the request while a larger size exists', () => {
    // The failure this guards is the inverse of upscaling and just as bad:
    // handing back the 64 for a 100px slot and letting it be drawn large.
    for (const px of [1, 40, 100, 299, 500]) {
      const { actualPx } = artworkUrl(SPOTIFY, px)
      expect(actualPx).toBeGreaterThanOrEqual(Math.min(px, SPOTIFY_NATIVE_MAX))
    }
  })

  test('Apple substitutes the exact size asked for', () => {
    const { url, actualPx } = artworkUrl(APPLE, 1400)
    expect(actualPx).toBe(1400)
    expect(url).toContain(encodeURIComponent('1400x1400bb.jpg'))
  })

  test('the documented ceiling is ~3000px, per §14.3 row 26', () => {
    // D-050: the literal is the requirement. Without this, moving the ceiling
    // to 9000 — or removing it — leaves every other artwork test green.
    expect(TEMPLATE_ARTWORK_CEILING_PX).toBe(3000)
  })

  test('a template with no recorded size still refuses to upscale', () => {
    // Before this, `actualPx` for a bare template was whatever was asked for,
    // including 9000 — so the never-upscale promise held only for adapters that
    // remembered to populate `sizes`.
    expect(artworkUrl(APPLE, 9000).actualPx).toBe(TEMPLATE_ARTWORK_CEILING_PX)
    expect(artworkUrl(APPLE, 3001).actualPx).toBe(TEMPLATE_ARTWORK_CEILING_PX)
    expect(artworkUrl(APPLE, 3000).actualPx).toBe(3000)
    expect(artworkUrl(APPLE, 2999).actualPx).toBe(2999)
  })

  test('a template that records its native size is clamped to it too', () => {
    const capped: Artwork = {
      ...APPLE,
      sizes: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/3000x3000bb.jpg', w: 3000, h: 3000 }],
    }
    expect(artworkUrl(capped, 4000).actualPx).toBe(3000)
    expect(artworkUrl(capped, 1400).actualPx).toBe(1400)
  })
})

describe('artworkUrl — the URL is same-origin (D-014)', () => {
  // Cross-origin pixels will not paint into a canvas under read-back-allowed
  // rendering, and that is exactly how both providers serve artwork. Under the
  // T1 composite the panel is painted into a canvas, so a raw provider URL
  // renders as a hole rather than as an error anyone would see.
  test.each([
    ['apple', APPLE],
    ['spotify', SPOTIFY],
  ])('%s artwork is routed through the proxy path', (_label, art: Artwork) => {
    const { url } = artworkUrl(art, 600)
    expect(url.startsWith(`${ARTWORK_PROXY_PATH}?`)).toBe(true)
    expect(url).not.toMatch(/^https?:\/\//)
    expect(url).not.toMatch(/^\/\//)
  })

  test('the upstream url survives round-tripping through the proxy params', () => {
    const { url, actualPx } = artworkUrl(SPOTIFY, 1400)
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    expect(params.get('src')).toBe('https://i.scdn.co/image/640')
    expect(params.get('px')).toBe(String(actualPx))
  })
})

describe('artworkUrl — malformed input is a defect, not a data condition', () => {
  test.each([
    ['a template artwork with no template', { kind: 'template' } as Artwork],
    ['a fixed artwork with no sizes', { kind: 'fixed' } as Artwork],
    ['a fixed artwork with an empty size list', { kind: 'fixed', sizes: [] } as Artwork],
  ])('rejects %s', (_label, art: Artwork) => {
    expect(() => artworkUrl(art, 300)).toThrow(InvalidArtworkError)
  })

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a size of %p', (px) => {
    expect(() => artworkUrl(APPLE, px)).toThrow(InvalidArtworkError)
  })
})
