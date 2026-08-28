/**
 * `artworkUrl()` — size negotiation and the same-origin proxy contract.
 *
 * Two rules, both from pm-spec and both non-obvious enough that they are
 * enforced here rather than left to each adapter:
 *
 * 1. **Never upscale a sharp image (§14.3 row 26).** Apple substitutes any size
 *    into a URL template; Spotify has roughly three fixed sizes. Asking Spotify
 *    for 1400 gets you 640, and S13's art region must clamp to the 640 it
 *    actually received. The blurred off-raster bloom may upscale — blur hides
 *    it — but the sharp image may not, which is why the returned `actualPx` is
 *    part of the contract rather than an internal detail.
 * 2. **The URL is same-origin (D-014).** Both providers serve artwork
 *    cross-origin, and cross-origin pixels will not paint into a canvas under
 *    read-back-allowed rendering. Under the T1 composite the panel *is* painted
 *    into a canvas, so a raw provider URL renders as a hole. The proxy itself
 *    belongs to `packages/server-core`; the URL shape is agreed here so both
 *    sides bind to one constant.
 */

import type { Artwork } from './identity.ts'
import { InvalidArtworkError } from './errors.ts'

/**
 * The same-origin path every artwork URL is routed through.
 *
 * `packages/server-core` binds its proxy route to this constant rather than to
 * a string of its own, so the two cannot drift apart silently.
 */
export const ARTWORK_PROXY_PATH = '/artwork'

/** Query parameter carrying the upstream URL. */
export const ARTWORK_PROXY_SRC_PARAM = 'src'

/** Query parameter carrying the pixel size actually being requested. */
export const ARTWORK_PROXY_PX_PARAM = 'px'

/**
 * The largest size a template artwork is assumed to hold, in pixels.
 *
 * §14.3 row 26: Apple's URL template serves *"arbitrary sizes to ~3000px"*.
 * Above that the server is generating pixels it does not have, which is an
 * upscale performed remotely rather than locally — and §14.3 row 26 forbids the
 * result, not the location.
 *
 * ⚑ It is a **default ceiling, not the only one.** An artwork that records its
 * real native size in `sizes` is clamped to that instead, which is always more
 * accurate. This constant exists so the never-upscale promise holds
 * unconditionally rather than only for adapters that remembered to populate
 * `sizes` — a guarantee with a precondition an author has to remember is the
 * class of guarantee this package keeps finding does not hold.
 */
export const TEMPLATE_ARTWORK_CEILING_PX = 3000

/**
 * Wraps an upstream artwork URL in the same-origin proxy path.
 *
 * Returns a root-relative URL, which is same-origin by construction — there is
 * no host to get wrong and no configuration to forget.
 *
 * @param upstreamUrl the provider's own URL, fully substituted.
 * @param px the size being fetched, so the proxy can cache per size.
 */
export function buildArtworkProxyUrl(upstreamUrl: string, px: number): string {
  const params = new URLSearchParams()
  params.set(ARTWORK_PROXY_SRC_PARAM, upstreamUrl)
  params.set(ARTWORK_PROXY_PX_PARAM, String(px))
  return `${ARTWORK_PROXY_PATH}?${params.toString()}`
}

/** What `artworkUrl()` hands back: where to fetch, and what you will get. */
export interface ArtworkUrl {
  /** Same-origin, root-relative. Never a provider host. */
  readonly url: string
  /**
   * The pixel size the source actually is.
   *
   * The largest width at which the returned URL is still sharp. Treat it as a
   * ceiling: a sharp render wider than this is an upscale, and §14.3 row 26
   * forbids that. It may be smaller than the requested `px` (Spotify has three
   * fixed sizes and 1400 gets you 640) and it may be larger (asking for 100
   * against those same sizes gets you the 300, because the 64 would upscale).
   */
  readonly actualPx: number
}

function largestSize(
  sizes: readonly { readonly url: string; readonly w: number; readonly h: number }[],
): { readonly url: string; readonly w: number; readonly h: number } | null {
  let best: { readonly url: string; readonly w: number; readonly h: number } | null = null
  for (const size of sizes) {
    if (best === null || size.w > best.w) best = size
  }
  return best
}

/**
 * Resolves an `Artwork` to a fetchable same-origin URL at, or below, `px`.
 *
 * **Apple (`kind: "template"`)** substitutes arbitrary sizes, so the request is
 * honoured exactly up to a ceiling. If the artwork carries `sizes`, the largest
 * of them is the ceiling — an adapter that knows the source's real dimensions
 * records them there and gets exact upscale protection. Otherwise
 * {@link TEMPLATE_ARTWORK_CEILING_PX} applies, from §14.3 row 26's documented
 * ~3000px limit, so the promise holds even when nothing was recorded.
 *
 * **Spotify (`kind: "fixed"`)** picks the smallest size that is at least `px`;
 * failing that, the largest available. Both branches report what was actually
 * chosen, so requesting 1400 against a 640/300/64 array returns `actualPx: 640`
 * and the caller clamps its sharp render to 640. It never returns a size below
 * the request while a larger one exists, because that would be an upscale.
 *
 * @param a the artwork record from a `TrackRef`, `AlbumRef` or similar.
 * @param px the size wanted, in CSS pixels. Rounded to an integer; must be
 * finite and positive.
 * @throws {InvalidArtworkError} if `px` is not a positive finite number, or if
 * the artwork carries no usable source at all. Absent artwork is expressed by
 * the optional `artwork` field being absent, so a present-but-empty `Artwork`
 * is an adapter defect rather than a data condition.
 */
export function artworkUrl(a: Artwork, px: number): ArtworkUrl {
  if (!Number.isFinite(px) || px <= 0) {
    throw new InvalidArtworkError(`artwork size must be a positive finite number, got ${String(px)}`)
  }
  const wanted = Math.round(px)

  if (a.kind === 'template') {
    const template = a.template
    if (template === undefined || template.length === 0) {
      throw new InvalidArtworkError('template artwork carries no template url')
    }
    // A template artwork may record the source's native size; where it does,
    // that is the ceiling because it is the accurate one. Where it does not,
    // §14.3 row 26's documented ~3000px applies, so a request for 9000 is
    // clamped rather than passed through to a server that would upscale it.
    const recorded = a.sizes === undefined ? null : largestSize(a.sizes)
    const ceiling = recorded === null ? TEMPLATE_ARTWORK_CEILING_PX : recorded.w
    const actualPx = Math.min(wanted, ceiling)
    const upstream = template.replaceAll('{w}', String(actualPx)).replaceAll('{h}', String(actualPx))
    return { url: buildArtworkProxyUrl(upstream, actualPx), actualPx }
  }

  const sizes = a.sizes
  if (sizes === undefined || sizes.length === 0) {
    throw new InvalidArtworkError('fixed artwork carries no sizes')
  }

  // Smallest size that still covers the request. Downscaling is free; the
  // thing we must never do is hand back something smaller and let it be drawn
  // large, which is why `actualPx` travels with the url rather than beside it.
  let chosen: { readonly url: string; readonly w: number; readonly h: number } | null = null
  for (const size of sizes) {
    if (size.w >= wanted && (chosen === null || size.w < chosen.w)) chosen = size
  }
  if (chosen === null) chosen = largestSize(sizes)
  if (chosen === null) throw new InvalidArtworkError('fixed artwork carries no sizes')

  const actualPx = chosen.w
  return { url: buildArtworkProxyUrl(chosen.url, actualPx), actualPx }
}
