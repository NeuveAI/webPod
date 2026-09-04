import {
  artworkUrl,
  type MusicProvider,
  type TrackRef,
} from '@webpod/providers'
import type { NowPlayingMode, NowPlayingModeState, ScreenFrame } from '@webpod/state'

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
export type NowPlayingCenterState = Omit<NowPlayingModeState, 'frame'>
export interface NowPlayingCenterTransition {
  readonly state: NowPlayingCenterState
  readonly effect: 'none' | 'commit-scrub' | 'select-queue'
}
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

/** Creates the navigation frame for the provider-subscribed Now Playing screen. */
export function nowPlayingFrame(): ScreenFrame {
  return { screenId: 'S13', title: 'Now Playing', route: { kind: 'now-playing' }, density: 'medium', rows: [], highlightIndex: -1, windowStart: 0 }
}

/** Resolves same-origin artwork and clamps rendered pixels to the sharp source size. */
export function sharpArtwork(track: TrackRef, requestedPx = 176) {
  if (track.artwork === undefined) return null
  const resolved = artworkUrl(track.artwork, requestedPx)
  return { ...resolved, renderedPx: Math.min(requestedPx, resolved.actualPx) }
}

/** Returns only centre-button modes supported by the active provider. */
export function nowPlayingModes(provider: MusicProvider): readonly NowPlayingMode[] {
  return [
    'standard',
    ...(provider.supports('seek') ? ['scrub' as const] : []),
    'artwork',
    ...(provider.supports('queueRead') ? ['queue' as const] : []),
  ]
}

/** Advances through the capability-filtered centre-button cycle. */
export function nextNowPlayingMode(
  mode: NowPlayingMode,
  provider: MusicProvider,
): NowPlayingMode {
  const modes = nowPlayingModes(provider)
  const index = modes.indexOf(mode)
  return modes[(index + 1) % modes.length] ?? 'standard'
}

/** Resolves one centre press without conflating a scrub preview with a seek. */
export function transitionNowPlayingCenter(
  state: NowPlayingCenterState,
  provider: MusicProvider,
  queueSelectionPending = false,
): NowPlayingCenterTransition {
  if (state.queue === 'selecting') return { state, effect: 'none' }
  if (state.mode === 'scrub') {
    if (state.scrub === 'previewing') return { state: { ...state, scrub: 'committing' }, effect: 'commit-scrub' }
    if (state.scrub === 'committing') return { state, effect: 'none' }
  }
  if (state.mode === 'queue') {
    if (queueSelectionPending) return { state: { ...state, mode: 'standard', queue: 'selecting' }, effect: 'select-queue' }
  }
  return {
    state: { ...state, mode: nextNowPlayingMode(state.mode, provider), scrub: 'clean', queue: 'clean' },
    effect: 'none',
  }
}

/** Marks a wheel-adjusted scrub position as tentative until Center commits it. */
export function previewNowPlayingScrub(state: NowPlayingCenterState): NowPlayingCenterState {
  if (state.mode !== 'scrub') return state
  return { ...state, scrub: 'previewing', scrubRevision: state.scrubRevision + 1 }
}

/** Settles only the seek revision that Center actually committed. */
export function settleNowPlayingScrub(
  state: NowPlayingCenterState,
  revision: number,
  succeeded: boolean,
): NowPlayingCenterState {
  if (state.mode !== 'scrub' || state.scrub !== 'committing' || state.scrubRevision !== revision) return state
  return { ...state, scrub: succeeded ? 'clean' : 'previewing' }
}

/** Clears the queue-selection guard after its provider write settles. */
export function settleNowPlayingQueue(
  state: NowPlayingCenterState,
): NowPlayingCenterState {
  if (state.queue !== 'selecting') return state
  return { ...state, queue: 'clean' }
}

/** Formats non-negative milliseconds as unambiguous minute:second text. */
export function formatDuration(durationMs: number): string {
  const seconds = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs / 1000)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export type { NowPlayingMode } from '@webpod/state'
