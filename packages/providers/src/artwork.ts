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
 * honoured exactly and `actualPx === px`. If the artwork also carries `sizes`,
 * the largest of them is treated as the native ceiling and `actualPx` clamps to
 * it — an adapter that knows the source's real dimensions can record them there
 * and get upscale protection for free.
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
    // A template artwork may also record the source's native size. Where it
    // does, that is the ceiling; where it does not, the provider substitutes
    // whatever is asked for and there is nothing to clamp against.
    const ceiling = a.sizes === undefined ? null : largestSize(a.sizes)
    const actualPx = ceiling === null ? wanted : Math.min(wanted, ceiling.w)
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
