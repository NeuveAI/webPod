import {
  artworkUrl,
  createFixtureProvider,
  type FixtureProvider,
  type TrackRef,
} from '@webpod/providers'
import { APPLE_SUPPORTS } from '@webpod/providers'
import type { PanelRow, ScreenFrame } from '@webpod/state'

export type Colourway = 'dark' | 'light'
export type PanelState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'permission-denied'
  | 'agent-active'
  | 'success-confirmation'
export const PANEL_STATES: readonly PanelState[] = ['ready', 'loading', 'empty', 'error', 'offline', 'permission-denied', 'agent-active', 'success-confirmation']
/** Narrows URL input to the closed set of renderable panel states. */
export function isPanelState(value: unknown): value is PanelState {
  return typeof value === 'string' && PANEL_STATES.some((state) => state === value)
}
export type NowPlayingMode = 'volume' | 'scrub' | 'rate' | 'lyrics'
export type ArtworkTone = 'pale' | 'dark'
export type RgbSample = readonly [red: number, green: number, blue: number]

export interface ArtworkTreatment {
  readonly dominant: string
  readonly dominantHue: number
  readonly meanLuminance: number
  readonly bloomOpacity: number
  readonly bloomLightness: readonly [minimum: number, maximum: number]
  readonly chromaMultiplier: number
}

const PALE_SAMPLE: RgbSample = [242, 229, 201]
const DARK_SAMPLE: RgbSample = [24, 18, 35]

/** Deterministic 3×3 colour and 8×8 luminance fixtures for visual proof. */
export function artworkSampleFixture(tone: ArtworkTone): { readonly dominant: readonly RgbSample[]; readonly luminance: readonly RgbSample[] } {
  const sample = tone === 'pale' ? PALE_SAMPLE : DARK_SAMPLE
  return { dominant: Array.from({ length: 9 }, () => sample), luminance: Array.from({ length: 64 }, () => sample) }
}

/**
 * Applies §5.11's adaptive bloom guards to a 3×3 dominant-colour sample and
 * an 8×8 luminance downsample. The fixed text plate is intentionally absent:
 * it is a CSS constant and must never be derived from artwork.
 */
export function deriveArtworkTreatment(
  colourway: Colourway,
  dominantSamples: readonly RgbSample[],
  luminanceSamples: readonly RgbSample[],
): ArtworkTreatment {
  if (dominantSamples.length !== 9 || luminanceSamples.length !== 64) {
    throw new Error('Artwork treatment requires exactly 3×3 colour and 8×8 luminance samples')
  }
  const average = dominantSamples.reduce((sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]] as [number, number, number], [0, 0, 0])
  const rgb = average.map((channel) => Math.round(channel / 9)) as [number, number, number]
  const meanLuminance = luminanceSamples.reduce((sum, sample) => sum + relativeLuminance(sample), 0) / 64
  const oklch = rgbToOklch(rgb)
  const dominantHue = excludeActorHue(oklch.hue)
  const dark = colourway === 'dark'
  let bloomOpacity = dark ? 0.72 : 0.62
  let bloomLightness: readonly [number, number] = dark ? [0.10, 0.34] : [0.78, 0.94]
  if (dark && meanLuminance > 0.34) bloomOpacity = Math.max(0.34, 0.72 - 0.9 * (meanLuminance - 0.34))
  if (dark && meanLuminance < 0.08) bloomLightness = [0.16, 0.38]
  if (!dark && meanLuminance < 0.30) {
    bloomOpacity = Math.max(0.28, 0.62 - 0.8 * (0.30 - meanLuminance))
    bloomLightness = [0.84, 0.96]
  }
  if (!dark && meanLuminance > 0.88) bloomLightness = [0.70, 0.88]
  const chromaMultiplier = (dark ? 0.55 : 0.40) * (oklch.chroma > 0.16 ? 0.62 : 1)
  const bloomChroma = Math.min(dark ? 0.14 : 0.09, oklch.chroma * chromaMultiplier)
  const bloomL = (bloomLightness[0] + bloomLightness[1]) / 2
  return {
    dominant: `oklch(${bloomL} ${bloomChroma} ${dominantHue})`,
    dominantHue,
    meanLuminance,
    bloomOpacity,
    bloomLightness,
    chromaMultiplier,
  }
}

const relativeLuminance = (sample: RgbSample) => {
  const linear = sample.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const [red = 0, green = 0, blue = 0] = linear
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const rgbToOklch = ([red8, green8, blue8]: RgbSample) => {
  const linear = [red8, green8, blue8].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const [red = 0, green = 0, blue = 0] = linear
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { lightness, chroma: Math.hypot(a, b), hue: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }
}

/** Rotates ambient bloom away from the human and agent attribution windows. */
export const excludeActorHue = (hue: number) => {
  if (hue >= 212.7 && hue <= 252.7) return hue - 212.7 < 252.7 - hue ? 212.7 : 252.7
  if (hue >= 131.7 && hue <= 171.7) return hue - 131.7 < 171.7 - hue ? 131.7 : 171.7
  return hue
}

export const fixtureProvider: FixtureProvider = createFixtureProvider({ supports: APPLE_SUPPORTS })

const row = (index: number, label: string, sublabel: string | null = null): PanelRow => ({
  index,
  label,
  sublabel,
  glyphs: ['descend'],
  provenance: null,
})

/** Builds the capability-filtered main menu. Unsupported provider rows are absent. */
export function mainMenuFrame(provider: FixtureProvider = fixtureProvider): ScreenFrame {
  const rows = [
    row(0, 'Cover Flow'),
    row(1, 'Playlists', String(provider.catalog.playlists.length)),
    row(2, 'Artists', String(provider.catalog.artists.length)),
    row(3, 'Albums', String(provider.catalog.albums.length)),
    row(4, 'Songs', String(provider.catalog.tracks.length)),
    row(5, 'Genres', String(provider.catalog.genres.length)),
    ...(provider.supports('stations') ? [row(6, 'Radio', String(provider.catalog.stations.length))] : []),
    row(7, 'Search'),
  ]
  return { screenId: 'S03', title: 'Music', density: 'compact', rows, highlightIndex: 3, windowStart: 0 }
}

/** Builds an album row model from provider-owned catalogue data. */
export function albumTracksFrame(provider: FixtureProvider = fixtureProvider, minimumRows = 0): ScreenFrame {
  const album = provider.catalog.albums[0]
  if (album === undefined) {
    return { screenId: 'S08', title: 'Album', density: 'compact', rows: [], highlightIndex: -1, windowStart: 0 }
  }
  const tracks = provider.catalog.tracksByAlbum.get(album.key) ?? []
  const rowCount = Math.max(tracks.length, minimumRows)
  return {
    screenId: 'S08',
    title: album.title,
    density: 'compact',
    rows: Array.from({ length: rowCount }, (_, index) => {
      const track = tracks[index % tracks.length]
      if (track === undefined) throw new Error('A long fixture requires at least one album track')
      return {
      index,
      label: index < tracks.length ? track.title : `${track.title} · ${index + 1}`,
      sublabel: formatDuration(track.durationMs),
      glyphs: index === 0 ? ['playing'] : [],
      provenance: null,
      }
    }),
    highlightIndex: tracks.length === 0 ? -1 : 0,
    windowStart: 0,
  }
}

/** Creates the navigation frame for the provider-subscribed Now Playing screen. */
export function nowPlayingFrame(): ScreenFrame {
  return { screenId: 'S13', title: 'Now Playing', density: 'medium', rows: [], highlightIndex: -1, windowStart: 0 }
}

/** Returns the provider's playing track, falling back to the first fixture track. */
export function currentTrack(provider: FixtureProvider = fixtureProvider): TrackRef {
  const track = provider.playback.now ?? provider.catalog.tracks[0]
  if (track === undefined) throw new Error('The fixture catalogue must contain a track')
  return track
}

/** Resolves same-origin artwork and clamps rendered pixels to the sharp source size. */
export function sharpArtwork(track: TrackRef, requestedPx = 176) {
  if (track.artwork === undefined) return null
  const resolved = artworkUrl(track.artwork, requestedPx)
  return { ...resolved, renderedPx: Math.min(requestedPx, resolved.actualPx) }
}

/** Returns only centre-button modes supported by the active provider. */
export function nowPlayingModes(provider: FixtureProvider = fixtureProvider): readonly NowPlayingMode[] {
  return provider.supports('lyrics')
    ? ['volume', 'scrub', 'rate', 'lyrics']
    : ['volume', 'scrub', 'rate']
}

/** Advances through the capability-filtered centre-button cycle. */
export function nextNowPlayingMode(
  mode: NowPlayingMode,
  provider: FixtureProvider = fixtureProvider,
): NowPlayingMode {
  const modes = nowPlayingModes(provider)
  const index = modes.indexOf(mode)
  return modes[(index + 1) % modes.length] ?? 'volume'
}

/** Formats non-negative milliseconds as unambiguous minute:second text. */
export function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
