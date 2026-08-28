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
export type NowPlayingMode = 'volume' | 'scrub' | 'rate' | 'lyrics'

export const fixtureProvider: FixtureProvider = createFixtureProvider({ supports: APPLE_SUPPORTS })

const row = (index: number, label: string, sublabel: string | null = null): PanelRow => ({
  index,
  label,
  sublabel,
  glyphs: ['descend'],
  provenance: null,
})

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

export function albumTracksFrame(provider: FixtureProvider = fixtureProvider): ScreenFrame {
  const album = provider.catalog.albums[0]
  if (album === undefined) {
    return { screenId: 'S08', title: 'Album', density: 'compact', rows: [], highlightIndex: -1, windowStart: 0 }
  }
  const tracks = provider.catalog.tracksByAlbum.get(album.key) ?? []
  return {
    screenId: 'S08',
    title: album.title,
    density: 'compact',
    rows: tracks.map((track, index) => ({
      index,
      label: track.title,
      sublabel: formatDuration(track.durationMs),
      glyphs: index === 0 ? ['playing'] : [],
      provenance: null,
    })),
    highlightIndex: tracks.length === 0 ? -1 : 0,
    windowStart: 0,
  }
}

export function nowPlayingFrame(): ScreenFrame {
  return { screenId: 'S13', title: 'Now Playing', density: 'medium', rows: [], highlightIndex: -1, windowStart: 0 }
}

export function currentTrack(provider: FixtureProvider = fixtureProvider): TrackRef {
  const track = provider.playback.now ?? provider.catalog.tracks[0]
  if (track === undefined) throw new Error('The fixture catalogue must contain a track')
  return track
}

export function sharpArtwork(track: TrackRef, requestedPx = 176) {
  if (track.artwork === undefined) return null
  const resolved = artworkUrl(track.artwork, requestedPx)
  return { ...resolved, renderedPx: Math.min(requestedPx, resolved.actualPx) }
}

export function nowPlayingModes(provider: FixtureProvider = fixtureProvider): readonly NowPlayingMode[] {
  return provider.supports('lyrics')
    ? ['volume', 'scrub', 'rate', 'lyrics']
    : ['volume', 'scrub', 'rate']
}

export function nextNowPlayingMode(
  mode: NowPlayingMode,
  provider: FixtureProvider = fixtureProvider,
): NowPlayingMode {
  const modes = nowPlayingModes(provider)
  const index = modes.indexOf(mode)
  return modes[(index + 1) % modes.length] ?? 'volume'
}

export function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
