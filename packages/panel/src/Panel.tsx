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
import { useEffect, useId, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react'

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
import { acquireAnnouncer, acquirePlaybackClock, sampleProviderArtwork, type ArtworkSamples } from './runtime'
import './panel.css'

const nowPlayingModeAtom = atom<NowPlayingMode>('volume')
const sampledArtworkAtom = atom<{ readonly url: string; readonly samples: ArtworkSamples } | null>(null)
const successResultAtom = atom<SuccessResult | null>(null)
const lovedTrackKeyAtom = atom<string | null>(null)
let initializedDocument: Document | null = null
const libraryCountLabels = new Set(['Playlists', 'Artists', 'Albums', 'Songs', 'Genres'])
const successOperations = new WeakMap<Document, Map<string, Promise<SuccessResult>>>()
const artworkRequests = new Map<string, Promise<ArtworkSamples>>()

interface SuccessResult {
  readonly screenId: 'S03' | 'S08' | 'S13'
  readonly text: string
  readonly objectKey: string
  readonly libraryTotal?: number
}

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
  readonly artworkTone?: ArtworkTone | null
  readonly density?: Density | null
  readonly longList?: boolean
}

export function Panel({
  colourway = 'dark',
  state = 'ready',
  dynamicTypeScale = 1,
  className,
  actor = 'human',
  artworkTone = null,
  density = null,
  longList = false,
}: PanelProps) {
  const rasterScale = Math.min(1.25, Math.max(1, dynamicTypeScale))
  useEffect(() => {
    if (initializedDocument !== document) {
      deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
      initializedDocument = document
    }
    deviceStore.set(setDensityActionAtom, density)
    deviceStore.set(setDynamicTypeScaleActionAtom, dynamicTypeScale)
  }, [actor, density, dynamicTypeScale, state])
  return (
    <div className="wp-panel-stage" style={{ '--wp-raster-scale': rasterScale } as CSSProperties}>
      <Provider store={deviceStore}>
        <PanelSurface colourway={colourway} state={state} className={className} actor={actor} artworkTone={artworkTone} longList={longList} />
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
}: {
  readonly colourway: Colourway
  readonly state: PanelState
  readonly className?: string
  readonly actor: 'human' | 'agent'
  readonly artworkTone: ArtworkTone | null
  readonly longList: boolean
}) {
  const panelId = useId()
  const frame = useAtomValue(currentScreenAtom)
  const announcement = useAtomValue(liveRegionAtom)
  const move = useSetAtom(detentActionAtom)
  const push = useSetAtom(pushScreenActionAtom)
  const pop = useSetAtom(popScreenActionAtom)
  const visibleRows = useAtomValue(visibleRowCountAtom)
  const density = useAtomValue(effectiveDensityAtom)
  useEffect(() => acquireAnnouncer(document, deviceStore), [])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
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
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const deltaMode = event.deltaMode === 1 ? 1 : event.deltaMode === 2 ? 2 : 0
    move({
      path: 'scroll',
      source: 'human',
      deltaY: event.deltaY,
      deltaMode,
      viewportPx: event.currentTarget.clientHeight,
      timestampMs: event.timeStamp,
    })
  }
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea') !== null) return
    event.currentTarget.focus({ preventScroll: true })
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea') !== null) return
    event.preventDefault()
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
      aria-activedescendant={frame?.screenId === 'S03' ? `${panelId}-menu-${frame.highlightIndex}` : undefined}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className="wp-sr-only" aria-live="polite" aria-atomic="true" data-announcement-seq={announcement?.seq}>
        {announcement?.text ?? ''}
      </span>
      {frame === null ? <PanelError message="The player is starting." /> : renderScreen(frame, state, colourway, artworkTone, visibleRows, actor, panelId)}
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

function renderScreen(frame: ScreenFrame, state: PanelState, colourway: Colourway, artworkTone: ArtworkTone | null, visibleRows: number, actor: 'human' | 'agent', panelId: string) {
  if (frame.screenId === 'S03') return <MainMenu frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} />
  if (frame.screenId === 'S08') return <AlbumTracks frame={frame} state={state} />
  if (frame.screenId === 'S13') return <NowPlaying state={state} colourway={colourway} artworkTone={artworkTone} actor={actor} />
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

function MainMenu({ frame, state, visibleRows, panelId }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string }) {
  const success = useLibrarySuccess('S03', frame.title, state)
  const selected = frame.rows[frame.highlightIndex] ?? null
  const baseRows = frame.rows
  const windowedRows = baseRows.slice(frame.windowStart, frame.windowStart + visibleRows)
  return (
    <div className="wp-screen">
      <TitleBar title={frame.title} />
      <div className="wp-menu-split">
        <ol className="wp-menu-list" aria-label="Music categories" role="listbox">
          {windowedRows.map((row) => (
            <li
              id={`${panelId}-menu-${row.index}`}
              role="option"
              aria-selected={row.index === frame.highlightIndex}
              data-empty={state === 'empty' && libraryCountLabels.has(row.label) ? 'true' : undefined}
              data-success={success?.screenId === 'S03' && row.label === 'Playlists' ? 'true' : undefined}
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
        {state === 'offline' ? <FooterReceipt>Offline. Showing cached library metadata.</FooterReceipt> : null}
        {state === 'permission-denied' ? <FooterReceipt>Browsing only — a subscription is needed to play.</FooterReceipt> : null}
        {success?.screenId === 'S03' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
        {state === 'loading' ? <span className="wp-sr-only">Loading your library counts.</span> : null}
      </div>
    </div>
  )
}

function AlbumTracks({ frame, state }: { readonly frame: ScreenFrame; readonly state: PanelState }) {
  const success = useLibrarySuccess('S08', frame.title, state)
  const rows = state === 'loading'
    ? Array.from({ length: 8 }, (_, index) => index)
    : frame.rows.slice(frame.windowStart, frame.windowStart + 8)
  return (
    <section className="wp-screen" aria-label="Album tracks" aria-busy={state === 'loading'} data-success-object={success?.objectKey} data-library-total={success?.libraryTotal}>
      <TitleBar title={frame.title} index={state === 'offline' ? 'Cached metadata' : undefined} />
      {state === 'empty' ? <PanelEmpty title="Nothing here plays in your region." detail="Search for it · Go to artist" /> : (
        <div className="wp-album-layout">
          <div className="wp-album-list">
            {state === 'loading' || state === 'error' || frame.rows.length <= 100
              ? <StaticTrackList rows={state === 'error' ? Array.from({ length: 8 }, (_, index) => index) : rows} frame={frame} state={state} success={success !== null} />
              : <VirtualTrackList frame={frame} state={state} />}
          </div>
          <div className="wp-album-preview" role="group" aria-label="Album details">
            <Artwork state={state === 'loading' || state === 'error' ? 'loading' : 'ready'} />
            <strong>{state === 'error' ? "Couldn't load this album." : frame.title}</strong>
            <span>{state === 'error' ? 'Retry' : state === 'permission-denied' ? 'Browse now · subscription needed to play' : '2009 · 48 min'}</span>
          </div>
        </div>
      )}
      {success?.screenId === 'S08' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
    </section>
  )
}

function StaticTrackList({
  rows,
  frame,
  state,
  success,
}: {
  readonly rows: readonly (number | ScreenFrame['rows'][number])[]
  readonly frame: ScreenFrame
  readonly state: PanelState
  readonly success: boolean
}) {
  return (
    <ol className="wp-track-list">
      {rows.map((row, index) => typeof row === 'number'
        ? <li className="wp-track-row wp-skeleton" key={row} aria-hidden="true"><i /></li>
        : <TrackRow key={row.index} row={row} displayIndex={frame.windowStart + index + 1} frame={frame} state={state} success={success} />)}
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
        return row === undefined ? null : <TrackRow key={row.index} row={row} displayIndex={item.index + 1} frame={frame} state={state} success={false} style={{ transform: `translateY(${item.start}px)` }} />
      })}
    </ol>
  )
}

function TrackRow({
  row,
  displayIndex,
  frame,
  state,
  success,
  style,
}: {
  readonly row: ScreenFrame['rows'][number]
  readonly displayIndex: number
  readonly frame: ScreenFrame
  readonly state: PanelState
  readonly success: boolean
  readonly style?: CSSProperties
}) {
  return (
    <li
      className="wp-track-row"
      data-unavailable={state === 'offline' ? 'true' : undefined}
      data-agent={state === 'agent-active' && row.index === frame.highlightIndex ? 'true' : undefined}
      data-success={success && row.index === frame.highlightIndex ? 'true' : undefined}
      aria-current={row.index === frame.highlightIndex ? 'true' : undefined}
      style={style}
    >
      <span className="wp-track-number">{success && row.index === frame.highlightIndex ? '✓' : displayIndex}</span>
      <span className="wp-track-title">{row.label}</span>
      <span className="wp-row-meta">{state === 'offline' ? '☁︎' : row.sublabel}</span>
    </li>
  )
}

function NowPlaying({ state, colourway, artworkTone, actor }: { readonly state: PanelState; readonly colourway: Colourway; readonly artworkTone: ArtworkTone | null; readonly actor: 'human' | 'agent' }) {
  const mode = useAtomValue(nowPlayingModeAtom)
  const sampledArtwork = useAtomValue(sampledArtworkAtom)
  const setSampledArtwork = useSetAtom(sampledArtworkAtom)
  const success = useAtomValue(successResultAtom)
  const setSuccess = useSetAtom(successResultAtom)
  const lovedTrackKey = useAtomValue(lovedTrackKeyAtom)
  const setLovedTrackKey = useSetAtom(lovedTrackKeyAtom)
  useSyncExternalStore(fixtureProvider.onPlaybackChange, playbackVersion, serverPlaybackVersion)
  useSyncExternalStore(fixtureProvider.onProgress, progressVersion, serverProgressVersion)
  const playback = fixtureProvider.playback
  const progressTick = { positionMs: playback.positionMs, durationMs: playback.durationMs }
  const track = playback.now ?? currentTrack()
  const art = sharpArtwork(track, 176)
  const artUrl = art?.url ?? null
  useEffect(() => acquirePlaybackClock(document, fixtureProvider, {
    now: () => performance.now(),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    clearInterval: (handle) => window.clearInterval(handle),
  }), [])
  useEffect(() => {
    if (artworkTone !== null || artUrl === null) return
    let live = true
    const request = artworkRequests.get(artUrl) ?? sampleProviderArtwork(artUrl)
    artworkRequests.set(artUrl, request)
    void request.then((samples) => {
      if (live) setSampledArtwork({ url: artUrl, samples })
    }).catch(() => {
      if (live) setSampledArtwork(null)
    })
    return () => { live = false }
  }, [artUrl, artworkTone, setSampledArtwork])
  useEffect(() => {
    if (state !== 'success-confirmation') return
    let live = true
    const operation = successOperation(document, 'S13', async () => {
      await fixtureProvider.setVolume(actor === 'human' ? 72 : 68)
      return { screenId: 'S13', text: 'Volume changed.', objectKey: 'playback.volume' }
    })
    void operation.then((result) => { if (live) setSuccess(result) })
    return () => { live = false }
  }, [actor, setSuccess, state])
  let samples: ArtworkSamples | null = null
  if (artworkTone !== null) {
    samples = artworkSampleFixture(artworkTone)
  } else if (sampledArtwork !== null && art !== null && sampledArtwork.url === art.url) {
    samples = sampledArtwork.samples
  }
  const treatment = samples === null ? null : deriveArtworkTreatment(colourway, samples.dominant, samples.luminance)
  const artStyle = {
    '--wp-art-dominant': treatment?.dominant ?? 'transparent',
    '--wp-bloom-opacity': treatment?.bloomOpacity ?? 0,
    '--wp-bloom-min': treatment?.bloomLightness[0] ?? 0,
    '--wp-bloom-max': treatment?.bloomLightness[1] ?? 0,
    '--wp-bloom-chroma': treatment?.chromaMultiplier ?? 0,
    '--wp-art-fallback': `linear-gradient(145deg, ${treatment?.dominant ?? '#334155'}, ${colourway === 'dark' ? '#080b11' : '#f2f6fb'})`,
  } as CSSProperties
  const progress = progressTick.durationMs === 0 ? 0 : Math.round(
    (progressTick.positionMs / progressTick.durationMs) * 100,
  )
  const loveTrack = async () => {
    await fixtureProvider.ratingSet(track, { love: 'love' })
    setLovedTrackKey(track.key)
  }
  if (state === 'loading') return <section className="wp-screen" aria-busy="true"><TitleBar title="Now Playing" /><span className="wp-sr-only">Loading the song.</span><div className="wp-now-loading"><Artwork state="loading" /><i /><i /><i /></div></section>
  if (state === 'error') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message={`Couldn't play “${track.title}”.`} detail="The next song is queued." /></section>
  if (state === 'permission-denied') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Playback needs an Apple Music subscription." detail="Learn more · Browse anyway" /></section>
  if (state === 'empty') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelEmpty title="Nothing is playing." detail="Shuffle Songs · Menu returns" /></section>
  return (
    <section className="wp-screen wp-now" aria-label="Now Playing" data-art-tone={artworkTone ?? 'provider'} data-art-sample-source={artworkTone === null ? samples === null ? 'pending' : 'provider' : 'fixture'} data-volume={playback.volume0to100} data-position-ms={playback.positionMs} style={artStyle}>
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
          <button type="button" aria-label="Love track" aria-pressed={lovedTrackKey === track.key} onClick={() => { void loveTrack() }}><span aria-hidden="true">♥</span></button>
          <span aria-label="Rate">★</span><span aria-label="Queue">≡</span>
        </div>
        {state === 'offline' ? <span className="wp-state-note">Offline. Playback unavailable; cached metadata shown.</span> : null}
        {state === 'agent-active' ? <span className="wp-state-note wp-agent-note">Assistant moved here</span> : null}
        {success?.screenId === 'S13' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
      </div>
    </section>
  )
}

function FooterReceipt({ children }: { readonly children: ReactNode }) {
  return <div className="wp-footer-receipt" role="status">{children}</div>
}

function Artwork({ state, large = false, tone }: { readonly state: PanelState; readonly large?: boolean; readonly tone?: ArtworkTone | null }) {
  if (state === 'loading') return <span className={large ? 'wp-art wp-art--large wp-skeleton' : 'wp-art wp-skeleton'} aria-hidden="true" />
  const art = sharpArtwork(currentTrack(), large ? 176 : 88)
  const fixtureSurface = tone === 'pale'
    ? 'linear-gradient(145deg, rgb(250 240 214), rgb(218 188 142))'
    : tone === 'dark'
      ? 'linear-gradient(145deg, rgb(49 35 69), rgb(12 10 20))'
      : null
  return (
    <span className={large ? 'wp-art wp-art--large' : 'wp-art'} style={{ '--wp-art-max': `${art?.renderedPx ?? 104}px`, backgroundImage: fixtureSurface ?? (art === null ? undefined : `url(${art.url}), var(--wp-art-fallback, linear-gradient(145deg, #334155, #0b0d11))`) } as CSSProperties}>
      {tone === null && art !== null ? <img src={art.url} alt="" data-provider-artwork="true" /> : null}
      {art === null ? <span className="wp-art__fallback" aria-hidden="true">◒</span> : null}
    </span>
  )
}

function useLibrarySuccess(screenId: 'S03' | 'S08', title: string, state: PanelState): SuccessResult | null {
  const success = useAtomValue(successResultAtom)
  const setSuccess = useSetAtom(successResultAtom)
  useEffect(() => {
    if (state !== 'success-confirmation') return
    let live = true
    const track = currentTrack()
    const operation = successOperation(document, screenId, async () => {
      const playlist = await fixtureProvider.playlistCreate({ name: `${title} Picks`, tracks: [track] })
      const library = await fixtureProvider.libraryList('playlists')
      return {
        screenId,
        text: `Created “${playlist.name}”.`,
        objectKey: playlist.key,
        ...(library.total === null ? {} : { libraryTotal: library.total }),
      }
    })
    void operation.then((result) => { if (live) setSuccess(result) })
    return () => { live = false }
  }, [screenId, setSuccess, state, title])
  return success?.screenId === screenId ? success : null
}

function successOperation(owner: Document, key: SuccessResult['screenId'], create: () => Promise<SuccessResult>): Promise<SuccessResult> {
  const operations = successOperations.get(owner) ?? new Map<string, Promise<SuccessResult>>()
  successOperations.set(owner, operations)
  const existing = operations.get(key)
  if (existing !== undefined) return existing
  const operation = create()
  operations.set(key, operation)
  return operation
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
