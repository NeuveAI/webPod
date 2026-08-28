import { Provider, atom, useAtomValue, useSetAtom } from 'jotai'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  currentScreenAtom,
  detentActionAtom,
  deviceStore,
  effectiveDensityAtom,
  liveRegionAtom,
  popScreenActionAtom,
  pushScreenActionAtom,
  resetStackActionAtom,
  setDynamicTypeScaleActionAtom,
  setDensityActionAtom,
  visibleRowCountAtom,
  type Density,
  type ScreenFrame,
} from '@webpod/state'
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import {
  albumTracksFrame,
  artworkSampleFixture,
  currentTrack,
  deriveArtworkTreatment,
  fixtureProvider,
  mainMenuFrame,
  nextNowPlayingMode,
  nowPlayingFrame,
  sharpArtwork,
  type Colourway,
  type ArtworkTone,
  type NowPlayingMode,
  type PanelState,
} from './model'
import './panel.css'

const nowPlayingModeAtom = atom<NowPlayingMode>('volume')
let initializedDocument: Document | null = null
const libraryCountLabels = new Set(['Playlists', 'Artists', 'Albums', 'Songs', 'Genres'])

/**
 * Renders one 272×204 semantic panel against the document singleton store.
 * Store initialization and Dynamic Type synchronization occur after commit;
 * render itself never mutates external state. Multiple colourways may safely
 * subscribe to the same store and provider.
 */
export interface PanelProps {
  readonly colourway?: Colourway
  readonly state?: PanelState
  readonly dynamicTypeScale?: number
  readonly className?: string
  readonly actor?: 'human' | 'agent'
  readonly artworkTone?: ArtworkTone
  readonly density?: Density | null
  readonly longList?: boolean
  readonly offlineDownloaded?: boolean
}

export function Panel({
  colourway = 'dark',
  state = 'ready',
  dynamicTypeScale = 1,
  className,
  actor = 'human',
  artworkTone = 'dark',
  density = null,
  longList = false,
  offlineDownloaded = false,
}: PanelProps) {
  const rasterScale = Math.min(1.25, Math.max(1, dynamicTypeScale))
  useEffect(() => {
    if (initializedDocument !== document) {
      deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
      initializedDocument = document
    }
    deviceStore.set(setDensityActionAtom, density)
    deviceStore.set(setDynamicTypeScaleActionAtom, dynamicTypeScale)
    if (state === 'success-confirmation') void fixtureProvider.setVolume(actor === 'human' ? 72 : 68)
  }, [actor, density, dynamicTypeScale, state])
  return (
    <div className="wp-panel-stage" style={{ '--wp-raster-scale': rasterScale } as CSSProperties}>
      <Provider store={deviceStore}>
        <PanelSurface colourway={colourway} state={state} className={className} actor={actor} artworkTone={artworkTone} longList={longList} offlineDownloaded={offlineDownloaded} />
      </Provider>
    </div>
  )
}

function PanelSurface({
  colourway,
  state,
  className,
  actor,
  artworkTone,
  longList,
  offlineDownloaded,
}: {
  readonly colourway: Colourway
  readonly state: PanelState
  readonly className?: string
  readonly actor: 'human' | 'agent'
  readonly artworkTone: ArtworkTone
  readonly longList: boolean
  readonly offlineDownloaded: boolean
}) {
  const frame = useAtomValue(currentScreenAtom)
  const announcement = useAtomValue(liveRegionAtom)
  const move = useSetAtom(detentActionAtom)
  const push = useSetAtom(pushScreenActionAtom)
  const pop = useSetAtom(popScreenActionAtom)
  const visibleRows = useAtomValue(visibleRowCountAtom)
  const density = useAtomValue(effectiveDensityAtom)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move({
        path: 'key',
        source: 'human',
        direction: event.key === 'ArrowDown' ? 1 : -1,
        page: event.shiftKey,
        timestampMs: event.timeStamp,
      })
      return
    }
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault()
      pop()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      select(frame, push, longList)
    }
  }

  return (
    <div
      className={['wp-panel', className].filter(Boolean).join(' ')}
      data-colourway={colourway}
      data-screen={frame?.screenId ?? 'empty'}
      data-state={state}
      data-actor={actor}
      data-density={density}
      data-visible-rows={visibleRows}
      tabIndex={0}
      role="application"
      aria-label="webPod music player"
      aria-roledescription="click wheel music player"
      onKeyDown={onKeyDown}
    >
      <span className="wp-sr-only" aria-live="polite" aria-atomic="true">
        {announcement?.text ?? ''}
      </span>
      {frame === null ? <PanelError message="The player is starting." /> : renderScreen(frame, state, colourway, artworkTone, visibleRows, offlineDownloaded)}
    </div>
  )
}

function select(frame: ScreenFrame | null, push: (frame: ScreenFrame) => void, longList: boolean) {
  if (frame === null) return
  if (frame.screenId === 'S03') {
    const selected = frame.rows[frame.highlightIndex]
    if (selected?.label === 'Albums') push(albumTracksFrame(fixtureProvider, longList ? 120 : 0))
    return
  }
  if (frame.screenId === 'S08') {
    const album = fixtureProvider.catalog.albums[0]
    const tracks = album === undefined ? [] : fixtureProvider.catalog.tracksByAlbum.get(album.key) ?? []
    void fixtureProvider.play({ kind: 'tracks', tracks, startIndex: Math.max(0, frame.highlightIndex) })
    push(nowPlayingFrame())
  }
  if (frame.screenId === 'S13') {
    deviceStore.set(nowPlayingModeAtom, nextNowPlayingMode(deviceStore.get(nowPlayingModeAtom)))
  }
}

function renderScreen(frame: ScreenFrame, state: PanelState, colourway: Colourway, artworkTone: ArtworkTone, visibleRows: number, offlineDownloaded: boolean) {
  if (frame.screenId === 'S03') return <MainMenu frame={frame} state={state} visibleRows={visibleRows} />
  if (frame.screenId === 'S08') return <AlbumTracks frame={frame} state={state} />
  if (frame.screenId === 'S13') return <NowPlaying state={state} colourway={colourway} artworkTone={artworkTone} offlineDownloaded={offlineDownloaded} />
  return <PanelError message="This screen is not part of the MVP preview." />
}

function TitleBar({ title, index }: { readonly title: string; readonly index?: string }) {
  return (
    <header className="wp-titlebar">
      <span className="wp-titlebar__side">{index ?? ''}</span>
      <strong>{title}</strong>
      <span className="wp-titlebar__side wp-titlebar__battery" role="img" aria-label="Battery full"><span aria-hidden="true">▰</span></span>
    </header>
  )
}

function MainMenu({ frame, state, visibleRows }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number }) {
  const selected = frame.rows[frame.highlightIndex] ?? null
  const baseRows = frame.rows
  const firstRow = baseRows[0]
  const displayRows = state === 'offline' && firstRow !== undefined
    ? [firstRow, { ...firstRow, index: 99, label: 'Downloads', sublabel: null }, ...baseRows.slice(1)]
    : baseRows
  const windowedRows = displayRows.slice(frame.windowStart, frame.windowStart + visibleRows)
  return (
    <div className="wp-screen">
      <TitleBar title={frame.title} />
      <div className="wp-menu-split">
        <ol className="wp-menu-list" aria-label="Music categories" role="listbox" aria-activedescendant={`wp-menu-${frame.highlightIndex}`}>
          {windowedRows.map((row) => (
            <li
              id={`wp-menu-${row.index}`}
              role="option"
              aria-selected={row.index === frame.highlightIndex}
              data-empty={state === 'empty' && libraryCountLabels.has(row.label) ? 'true' : undefined}
              data-unavailable={(state === 'offline' && (row.label === 'Radio' || row.label === 'Search')) || (state === 'permission-denied' && row.label === 'Radio') ? 'true' : undefined}
              key={row.index}
              className="wp-menu-row"
              aria-current={row.index === frame.highlightIndex ? 'true' : undefined}
            >
              <span>{row.label}</span>
              <span className="wp-row-meta">{state === 'error' && row.sublabel !== null ? '—' : state === 'loading' && row.sublabel !== null ? '…' : state === 'empty' && libraryCountLabels.has(row.label) ? '0' : row.sublabel}</span>
              <span aria-hidden="true">{state === 'offline' && (row.label === 'Radio' || row.label === 'Search') ? '☁︎' : state === 'permission-denied' && row.label === 'Radio' ? '🔒' : '›'}</span>
            </li>
          ))}
        </ol>
        <div className="wp-menu-preview" aria-label={`${selected?.label ?? 'Music'} preview`} role="group">
          <Artwork state={state === 'loading' || state === 'error' ? 'loading' : 'ready'} />
          <strong>{state === 'error' ? "Couldn't load your library." : selected?.label ?? 'Music'}</strong>
          <span>{state === 'error' ? 'Retry' : selected?.sublabel ?? 'Rotate to browse'}</span>
          <span className="wp-scroll-track" aria-hidden="true"><i /></span>
          {state === 'offline' ? <small>Cached library</small> : null}
          {state === 'agent-active' ? <small className="wp-agent-note">Assistant browsing</small> : null}
        </div>
        {state === 'empty' ? <FooterReceipt>Nothing in your library yet. Try Radio, or search for anything.</FooterReceipt> : null}
        {state === 'offline' ? <FooterReceipt>Offline. 214 songs are downloaded.</FooterReceipt> : null}
        {state === 'permission-denied' ? <FooterReceipt>Browsing only — a subscription is needed to play.</FooterReceipt> : null}
        {state === 'loading' ? <span className="wp-sr-only">Loading your library counts.</span> : null}
      </div>
    </div>
  )
}

function AlbumTracks({ frame, state }: { readonly frame: ScreenFrame; readonly state: PanelState }) {
  const rows = state === 'loading'
    ? Array.from({ length: 8 }, (_, index) => index)
    : frame.rows.slice(frame.windowStart, frame.windowStart + 8)
  return (
    <section className="wp-screen" aria-label="Album tracks" aria-busy={state === 'loading'}>
      <TitleBar title={frame.title} index={state === 'offline' ? '4 of 12 downloaded' : undefined} />
      {state === 'empty' ? <PanelEmpty title="Nothing here plays in your region." detail="Search for it · Go to artist" /> : (
        <div className="wp-album-layout">
          <div className="wp-album-list">
            {state === 'loading' || state === 'error' || frame.rows.length <= 100
              ? <StaticTrackList rows={state === 'error' ? Array.from({ length: 8 }, (_, index) => index) : rows} frame={frame} state={state} />
              : <VirtualTrackList frame={frame} state={state} />}
          </div>
          <div className="wp-album-preview" role="group" aria-label="Album details">
            <Artwork state={state === 'loading' || state === 'error' ? 'loading' : 'ready'} />
            <strong>{state === 'error' ? "Couldn't load this album." : frame.title}</strong>
            <span>{state === 'error' ? 'Retry' : state === 'permission-denied' ? 'Browse now · subscription needed to play' : '2009 · 48 min'}</span>
          </div>
        </div>
      )}
      {state === 'success-confirmation' ? <FooterReceipt>Added to your library. &nbsp;⟲ Undo</FooterReceipt> : null}
    </section>
  )
}

function StaticTrackList({
  rows,
  frame,
  state,
}: {
  readonly rows: readonly (number | ScreenFrame['rows'][number])[]
  readonly frame: ScreenFrame
  readonly state: PanelState
}) {
  return (
    <ol className="wp-track-list">
      {rows.map((row, index) => typeof row === 'number'
        ? <li className="wp-track-row wp-skeleton" key={row} aria-hidden="true"><i /></li>
        : <TrackRow key={row.index} row={row} displayIndex={frame.windowStart + index + 1} frame={frame} state={state} />)}
    </ol>
  )
}

function VirtualTrackList({ frame, state }: { readonly frame: ScreenFrame; readonly state: PanelState }) {
  const scrollRef = useRef<HTMLOListElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: frame.rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 26, overscan: 4 })
  useEffect(() => virtualizer.scrollToIndex(frame.highlightIndex, { align: 'auto' }), [frame.highlightIndex, virtualizer])
  return (
    <ol ref={scrollRef} className="wp-track-list wp-track-list--virtual" data-virtual-count={frame.rows.length}>
      <li className="wp-virtual-space" style={{ blockSize: virtualizer.getTotalSize() }} aria-hidden="true" />
      {virtualizer.getVirtualItems().map((item) => {
        const row = frame.rows[item.index]
        return row === undefined ? null : <TrackRow key={row.index} row={row} displayIndex={item.index + 1} frame={frame} state={state} style={{ transform: `translateY(${item.start}px)` }} />
      })}
    </ol>
  )
}

function TrackRow({
  row,
  displayIndex,
  frame,
  state,
  style,
}: {
  readonly row: ScreenFrame['rows'][number]
  readonly displayIndex: number
  readonly frame: ScreenFrame
  readonly state: PanelState
  readonly style?: CSSProperties
}) {
  return (
    <li
      className="wp-track-row"
      data-unavailable={state === 'offline' ? 'true' : undefined}
      data-downloaded={state === 'offline' && displayIndex % 3 === 1 ? 'true' : undefined}
      data-agent={state === 'agent-active' && row.index === frame.highlightIndex ? 'true' : undefined}
      data-success={state === 'success-confirmation' && row.index === frame.highlightIndex ? 'true' : undefined}
      aria-current={row.index === frame.highlightIndex ? 'true' : undefined}
      style={style}
    >
      <span className="wp-track-number">{state === 'success-confirmation' && row.index === frame.highlightIndex ? '✓' : displayIndex}</span>
      <span className="wp-track-title">{row.label}</span>
      <span className="wp-row-meta">{state === 'offline' ? displayIndex % 3 === 1 ? '⤓' : '☁︎' : row.sublabel}</span>
    </li>
  )
}

function NowPlaying({ state, colourway, artworkTone, offlineDownloaded }: { readonly state: PanelState; readonly colourway: Colourway; readonly artworkTone: ArtworkTone; readonly offlineDownloaded: boolean }) {
  const mode = useAtomValue(nowPlayingModeAtom)
  useSyncExternalStore(fixtureProvider.onPlaybackChange, playbackVersion, serverPlaybackVersion)
  useSyncExternalStore(fixtureProvider.onProgress, progressVersion, serverProgressVersion)
  const playback = fixtureProvider.playback
  const progressTick = { positionMs: playback.positionMs, durationMs: playback.durationMs }
  useEffect(() => {
    if (playback.status === 'playing' && playback.positionMs === 0) fixtureProvider.tick(1_000)
  }, [playback.positionMs, playback.status])
  const track = playback.now ?? currentTrack()
  const samples = artworkSampleFixture(artworkTone)
  const treatment = deriveArtworkTreatment(colourway, samples.dominant, samples.luminance)
  const artStyle = {
    '--wp-art-dominant': treatment.dominant,
    '--wp-bloom-opacity': treatment.bloomOpacity,
    '--wp-bloom-min': treatment.bloomLightness[0],
    '--wp-bloom-max': treatment.bloomLightness[1],
    '--wp-bloom-chroma': treatment.chromaMultiplier,
    '--wp-art-fallback': `linear-gradient(145deg, ${treatment.dominant}, ${colourway === 'dark' ? '#080b11' : '#f2f6fb'})`,
  } as CSSProperties
  const progress = progressTick.durationMs === 0 ? 0 : Math.round(
    (progressTick.positionMs / progressTick.durationMs) * 100,
  )
  if (state === 'loading') return <section className="wp-screen" aria-busy="true"><TitleBar title="Now Playing" /><span className="wp-sr-only">Loading the song.</span><div className="wp-now-loading"><Artwork state="loading" /><i /><i /><i /></div></section>
  if (state === 'error') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message={`Couldn't play “${track.title}”.`} detail="The next song is queued." /></section>
  if (state === 'permission-denied') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Playback needs an Apple Music subscription." detail="Learn more · Browse anyway" /></section>
  if (state === 'empty') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelEmpty title="Nothing is playing." detail="Shuffle Songs · Menu returns" /></section>
  return (
    <section className="wp-screen wp-now" aria-label="Now Playing" data-art-tone={artworkTone} data-volume={playback.volume0to100} data-position-ms={playback.positionMs} style={artStyle}>
      <TitleBar title="Now Playing" index={track.albumName ?? '1 of 42'} />
      <div className="wp-now-body">
        <Artwork state="ready" large tone={artworkTone} />
        <div className="wp-now-meta">
          <h1>{track.title}</h1>
          <p>{track.artistName}</p>
          <p>{track.albumName ?? 'Unknown album'}</p>
          <span className="wp-source">Demo library</span>
          <span className="wp-mode-chip">{mode}</span>
        </div>
        <div className="wp-progress" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <i style={{ inlineSize: `${progress}%` }} />
        </div>
        <div className="wp-times"><span>{formatTime(progressTick.positionMs)}</span><span>-{formatTime(Math.max(0, progressTick.durationMs - progressTick.positionMs))}</span></div>
        <div className="wp-actions" aria-label="Playback status">
          <span aria-label="Shuffle on">⌘</span><span aria-label="Repeat off">↻</span>
          <span aria-label="Loved">♥</span><span aria-label="Rate">★</span><span aria-label="Queue">≡</span>
        </div>
        {state === 'offline' ? <span className="wp-state-note">{offlineDownloaded ? '☁︎/ Downloaded' : '☁︎/ You’re offline. · 214 downloaded songs still play. · Play downloads'}</span> : null}
        {state === 'agent-active' ? <span className="wp-state-note wp-agent-note">Assistant moved here</span> : null}
        {state === 'success-confirmation' ? <FooterReceipt>Volume changed.</FooterReceipt> : null}
      </div>
    </section>
  )
}

function FooterReceipt({ children }: { readonly children: ReactNode }) {
  return <div className="wp-footer-receipt" role="status">{children}</div>
}

function Artwork({ state, large = false, tone }: { readonly state: PanelState; readonly large?: boolean; readonly tone?: ArtworkTone }) {
  if (state === 'loading') return <span className={large ? 'wp-art wp-art--large wp-skeleton' : 'wp-art wp-skeleton'} aria-hidden="true" />
  const art = sharpArtwork(currentTrack(), large ? 176 : 88)
  const fixtureSurface = tone === 'pale'
    ? 'linear-gradient(145deg, rgb(250 240 214), rgb(218 188 142))'
    : tone === 'dark'
      ? 'linear-gradient(145deg, rgb(49 35 69), rgb(12 10 20))'
      : null
  return (
    <span className={large ? 'wp-art wp-art--large' : 'wp-art'} style={{ '--wp-art-max': `${art?.renderedPx ?? 104}px`, backgroundImage: fixtureSurface ?? (art === null ? undefined : `url(${art.url}), var(--wp-art-fallback, linear-gradient(145deg, #334155, #0b0d11))`) } as CSSProperties}>
      {art === null ? <span className="wp-art__fallback" aria-hidden="true">◒</span> : null}
    </span>
  )
}

function PanelEmpty({ title, detail }: { readonly title: string; readonly detail: string }) {
  return <div className="wp-message"><strong>{title}</strong><span>{detail}</span></div>
}

function PanelError({ message, detail = 'Press Menu and try again.' }: { readonly message: string; readonly detail?: string }) {
  return <div className="wp-message" role="alert"><strong>{message}</strong><span>{detail}</span></div>
}

const playbackVersion = () => JSON.stringify(fixtureProvider.playback)
const serverPlaybackVersion = () => JSON.stringify(fixtureProvider.playback)
const progressVersion = () => `${fixtureProvider.playback.positionMs}/${fixtureProvider.playback.durationMs}`
const serverProgressVersion = () => `0/${fixtureProvider.playback.durationMs}`
const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
