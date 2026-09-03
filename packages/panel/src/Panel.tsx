import { Provider, atom, useAtomValue, useSetAtom } from 'jotai'
import type { FixtureProvider, MusicProvider, TrackRef } from '@webpod/providers'
import {
  currentScreenAtom,
  detentActionAtom,
  deviceStore,
  effectiveDensityAtom,
  liveRegionAtom,
  navigationIntentAtom,
  popScreenActionAtom,
  pressActionAtom,
  pushScreenActionAtom,
  resetStackActionAtom,
  setDynamicTypeScaleActionAtom,
  setDensityActionAtom,
  visibleRowCountAtom,
  type Density,
  type ScreenFrame,
} from '@webpod/state'
import { useEffect, useId, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react'

import {
  artworkSampleFixture,
  currentTrack,
  deriveArtworkTreatment,
  fixtureProvider,
  fixtureNavigationSource,
  nextNowPlayingMode,
  sharpArtwork,
  type Colourway,
  type ArtworkTone,
  type NowPlayingMode,
  type PanelState,
} from './model'
import { navigationRoot, playbackQueueForFrame, providerStatusFrame, selectNavigation, statusFrame, type NavigationDataSource, type NavigationStatus } from './navigation'
import { acquireAnnouncer, acquirePlaybackClock, sampleProviderArtwork, type ArtworkSamples } from './runtime'
import menuArtworkUrl from './assets/music-menu-art.png'
import { ListViewport, type ListRowContent } from './list-view'
import './panel.css'

const nowPlayingModeAtom = atom<NowPlayingMode>('volume')
const sampledArtworkAtom = atom<{ readonly url: string; readonly samples: ArtworkSamples } | null>(null)
const successResultAtom = atom<SuccessResult | null>(null)
const lovedTrackKeyAtom = atom<string | null>(null)
export const searchQueryAtom = atom('')
let initializedDocument: Document | null = null
let initializedProvider: MusicProvider | null = null
let initializedSource: NavigationDataSource | null = null
let initializedSession: MusicProvider['session'] | undefined
let initializedAccountStatus: NavigationStatus | null | undefined
const libraryCountLabels = new Set(['Playlists', 'Artists', 'Albums', 'Songs', 'Genres'])
const successOperations = new WeakMap<Document, Map<string, Promise<SuccessResult>>>()
const artworkRequests = new Map<string, Promise<ArtworkSamples>>()
const handledNavigationSeq = new WeakMap<Document, number>()

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
  readonly provider?: MusicProvider
  readonly navigationSource?: NavigationDataSource
  /** Overrides derived account posture; `null` explicitly keeps the normal screen route. */
  readonly accountStatus?: NavigationStatus | null
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
  provider = fixtureProvider,
  navigationSource = fixtureNavigationSource,
  accountStatus,
}: PanelProps) {
  const session = useSyncExternalStore(provider.onSessionChange, () => provider.session, () => provider.session)
  const rasterScale = Math.min(1.25, Math.max(1, dynamicTypeScale))
  useEffect(() => {
    const accountFrame = accountStatus === undefined ? providerStatusFrame(provider) : accountStatus === null ? null : statusFrame(accountStatus, provider.displayName)
    if (initializedDocument !== document || initializedProvider !== provider || initializedSource !== navigationSource || initializedSession !== session || initializedAccountStatus !== accountStatus) {
      deviceStore.set(resetStackActionAtom, [accountFrame ?? navigationRoot(navigationSource, provider)])
      initializedDocument = document
      initializedProvider = provider
      initializedSource = navigationSource
      initializedSession = session
      initializedAccountStatus = accountStatus
    }
    deviceStore.set(setDensityActionAtom, density)
    deviceStore.set(setDynamicTypeScaleActionAtom, dynamicTypeScale)
  }, [accountStatus, actor, density, dynamicTypeScale, navigationSource, provider, session, state])
  return (
    <div className="wp-panel-stage" style={{ '--wp-raster-scale': rasterScale } as CSSProperties}>
      <Provider store={deviceStore}>
        <PanelSurface colourway={colourway} state={state} className={className} actor={actor} artworkTone={artworkTone} longList={longList} provider={provider} navigationSource={navigationSource} />
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
  provider,
  navigationSource,
}: {
  readonly colourway: Colourway
  readonly state: PanelState
  readonly className?: string
  readonly actor: 'human' | 'agent'
  readonly artworkTone: ArtworkTone | null
  readonly longList: boolean
  readonly provider: MusicProvider
  readonly navigationSource: NavigationDataSource
}) {
  void longList
  const panelId = useId()
  const frame = useAtomValue(currentScreenAtom)
  const announcement = useAtomValue(liveRegionAtom)
  const move = useSetAtom(detentActionAtom)
  const push = useSetAtom(pushScreenActionAtom)
  const pop = useSetAtom(popScreenActionAtom)
  const press = useSetAtom(pressActionAtom)
  const navigationIntent = useAtomValue(navigationIntentAtom)
  const visibleRows = useAtomValue(visibleRowCountAtom)
  const density = useAtomValue(effectiveDensityAtom)
  useEffect(() => acquireAnnouncer(document, deviceStore), [])
  useEffect(() => {
    if (navigationIntent === null || navigationIntent.seq <= (handledNavigationSeq.get(document) ?? 0)) return
    handledNavigationSeq.set(document, navigationIntent.seq)
    if (navigationIntent.kind !== 'select' || frame === null) return
    if (frame.route?.kind === 'now-playing') {
      deviceStore.set(nowPlayingModeAtom, nextNowPlayingMode(deviceStore.get(nowPlayingModeAtom)))
      return
    }
    let live = true
    void selectNavigation(frame, navigationSource, provider, deviceStore.get(searchQueryAtom)).then((selection) => {
      if (live && selection.frame !== null) push(selection.frame)
    }).catch(() => {
      if (live) push(statusFrame('error'))
    })
    return () => { live = false }
  }, [frame, navigationIntent, navigationSource, provider, push])
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
      const handledByComposite = event.defaultPrevented
      event.preventDefault()
      if (handledByComposite) return
      press({ button: 'center', source: 'human', path: 'key' })
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
      aria-activedescendant={frame !== null && frame.rows.length > 0 ? `${panelId}-row-${frame.highlightIndex}` : undefined}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className="wp-sr-only" aria-live="polite" aria-atomic="true" data-announcement-seq={announcement?.seq}>
        {announcement?.text ?? ''}
      </span>
      {frame === null ? <PanelError message="The player is starting." /> : renderScreen(frame, state, colourway, artworkTone, visibleRows, actor, panelId, provider)}
    </div>
  )
}

function renderScreen(frame: ScreenFrame, state: PanelState, colourway: Colourway, artworkTone: ArtworkTone | null, visibleRows: number, actor: 'human' | 'agent', panelId: string, provider: MusicProvider) {
  if (frame.screenId === 'S03') return <MainMenu frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} />
  if (frame.route?.kind === 'album-tracks' || frame.route?.kind === 'playlist-tracks') return <NestedTrackList frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} />
  if (frame.screenId === 'S13') return <NowPlaying frame={frame} state={state} colourway={colourway} artworkTone={artworkTone} actor={actor} provider={provider} />
  if (frame.route?.kind === 'status') return <StatusScreen frame={frame} />
  return <BrowserList frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} />
}

function StatusScreen({ frame }: { readonly frame: ScreenFrame }) {
  if (frame.route?.kind !== 'status') return null
  const copy = {
    loading: ['Loading your music.', 'Please wait.'],
    empty: ['Nothing here yet.', 'Press Menu to go back.'],
    error: ["Couldn't load this section.", 'Press Menu and try again.'],
    offline: ['Music is offline.', 'Cached metadata remains available.'],
    'signed-out': [frame.title, 'Sign in, then return to your music.'],
    'playback-unavailable': ['Playback needs a paid music subscription.', 'You can still browse your library.'],
  } as const
  const [message, detail] = copy[frame.route.state]
  return <section className="wp-screen"><TitleBar title={frame.title} /><PanelError message={message} detail={detail} /></section>
}

type PanelIconName = 'battery' | 'chevron' | 'shuffle' | 'repeat' | 'heart' | 'star' | 'queue'

function PanelIcon({ name }: { readonly name: PanelIconName }) {
  const paths: Record<PanelIconName, ReactNode> = {
    battery: <><rect x="2" y="5" width="15" height="8" rx="1.5" /><path d="M19 8v2" /><path d="M4.5 7.5h8.5v3H4.5z" className="wp-icon-fill" /></>,
    chevron: <path d="m8 5 5 5-5 5" />,
    shuffle: <><path d="M3 6h2.5c4.5 0 4.5 8 9 8H17" /><path d="m14 11 3 3-3 3" /><path d="M3 14h2.5c1.25 0 2.15-.62 2.92-1.52" /><path d="M11.6 7.3C12.32 6.5 13.2 6 14.5 6H17" /><path d="m14 3 3 3-3 3" /></>,
    repeat: <><path d="m15 4 3 3-3 3" /><path d="M4 9V8a2 2 0 0 1 2-2h12" /><path d="m5 16-3-3 3-3" /><path d="M16 11v1a2 2 0 0 1-2 2H2" /></>,
    heart: <path d="M10 17.2 3.8 11A4 4 0 0 1 9.5 5.4L10 6l.5-.6A4 4 0 0 1 16.2 11Z" />,
    star: <path d="m10 2.8 2.15 4.35 4.8.7-3.48 3.38.82 4.78L10 13.76 5.71 16l.82-4.77L3.06 7.85l4.79-.7Z" />,
    queue: <><path d="M3 5h10M3 10h10M3 15h7" /><path d="m14 13 4 2-4 2Z" className="wp-icon-fill" /></>,
  }
  return <svg className={`wp-icon wp-icon--${name}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

function TitleBar({ title, index }: { readonly title: string; readonly index?: string }) {
  return (
    <header className="wp-titlebar">
      <span className="wp-titlebar__side">{index ?? ''}</span>
      <strong>{title}</strong>
      <span className="wp-titlebar__side wp-titlebar__battery" role="img" aria-label="Battery full"><PanelIcon name="battery" /></span>
    </header>
  )
}

function MainMenu({ frame, state, visibleRows, panelId }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string }) {
  const success = useLibrarySuccess('S03', frame.title, state)
  const selected = frame.rows[frame.highlightIndex] ?? null
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({
    index: row.index,
    primary: row.label,
    count: state === 'error' && row.sublabel !== null ? '—' : state === 'loading' && row.sublabel !== null ? '…' : state === 'empty' && libraryCountLabels.has(row.label) ? '0' : row.sublabel,
    chevron: <PanelIcon name="chevron" />,
    unavailable: (state === 'offline' && (row.label === 'Radio' || row.label === 'Search')) || (state === 'permission-denied' && row.label === 'Radio'),
    empty: state === 'empty' && libraryCountLabels.has(row.label),
    success: success?.screenId === 'S03' && row.label === 'Playlists',
  }))
  return (
    <div className="wp-screen">
      <TitleBar title={frame.title} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label="Music categories" panelId={panelId} preview={
        <div className="wp-menu-preview-content" aria-label={`${selected?.label ?? 'Music'} preview`} role="group">
          <Artwork state={state === 'loading' || state === 'error' ? 'loading' : 'ready'} variant="menu" />
          <strong>{state === 'error' ? "Couldn't load your library." : selected?.sublabel === null || selected === null ? selected?.label ?? 'Music' : `${selected.sublabel} ${selected.label.toLocaleLowerCase()}`}</strong>
          <span>{state === 'error' ? 'Retry' : 'Rotate to browse'}</span>
          {state === 'offline' ? <small>Cached library</small> : null}
          {state === 'agent-active' ? <small className="wp-agent-note">Assistant browsing</small> : null}
        </div>
      } />
      {state === 'empty' ? <FooterReceipt>Nothing in your library yet. Try Radio, or search for anything.</FooterReceipt> : null}
      {state === 'offline' ? <FooterReceipt>Offline. Showing cached library metadata.</FooterReceipt> : null}
      {state === 'permission-denied' ? <FooterReceipt>Browsing only — a subscription is needed to play.</FooterReceipt> : null}
      {success?.screenId === 'S03' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
      {state === 'loading' ? <span className="wp-sr-only">Loading your library counts.</span> : null}
    </div>
  )
}

function BrowserList({ frame, state, visibleRows, panelId }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string }) {
  const query = useAtomValue(searchQueryAtom)
  const setQuery = useSetAtom(searchQueryAtom)
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({ index: row.index, primary: row.label, secondary: row.sublabel, chevron: row.glyphs.includes('descend') ? <PanelIcon name="chevron" /> : undefined, unavailable: state === 'offline' }))
  const message = listStateMessage(frame, state, visibleRows)
  const search = frame.route?.kind === 'search-entry' ? <label className="wp-search-field"><span>Search Query</span><input name="music-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Artists, albums, songs…" autoComplete="off" /></label> : undefined
  return (
    <section className="wp-screen wp-browser-list" aria-label={frame.title} aria-busy={state === 'loading'}>
      <TitleBar title={frame.title} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label={frame.title} panelId={panelId} preview={search} message={message} />
      {state === 'offline' ? <FooterReceipt>Offline. Showing cached library metadata.</FooterReceipt> : null}
    </section>
  )
}

function NestedTrackList({ frame, state, visibleRows, panelId }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string }) {
  const success = useLibrarySuccess('S08', frame.title, state)
  const selected = frame.rows[frame.highlightIndex] ?? null
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({ index: row.index, leading: row.index + 1, primary: row.label, secondary: state === 'offline' ? '☁︎' : row.sublabel, unavailable: state === 'offline', agent: state === 'agent-active' && row.index === frame.highlightIndex, success: success !== null && row.index === frame.highlightIndex }))
  return (
    <section className="wp-screen" aria-label="Album tracks" aria-busy={state === 'loading'} data-success-object={success?.objectKey} data-library-total={success?.libraryTotal}>
      <TitleBar title={frame.title} index={state === 'offline' ? 'Cached metadata' : undefined} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label={`${frame.title} tracks`} panelId={panelId} message={listStateMessage(frame, state, visibleRows, 'Nothing here plays in your region.', 'Search for it · Go to artist')} preview={<div className="wp-track-preview" role="group" aria-label="Selected track details"><strong>{selected?.label ?? frame.title}</strong><span>{selected?.sublabel ?? 'No track selected'}</span><small>{frame.title}</small></div>} />
      {success?.screenId === 'S08' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
    </section>
  )
}

function listStateMessage(frame: ScreenFrame, state: PanelState, visibleRows: number, emptyTitle = `No ${frame.title.toLocaleLowerCase()} here.`, emptyDetail = 'Press Menu to go back.'): ReactNode | undefined {
  if (state === 'loading') return <div className="wp-list-loading" aria-label={`Loading ${frame.title}`}>{Array.from({ length: visibleRows }, (_, index) => <i className="wp-skeleton" key={index} />)}</div>
  if (state === 'error') return <PanelError message={`Couldn't load ${frame.title}.`} />
  if (state === 'permission-denied') return <PanelError message="Sign in to browse your music." detail="Press Menu to go back." />
  if (frame.rows.length === 0 || state === 'empty') return <PanelEmpty title={emptyTitle} detail={emptyDetail} />
  return undefined
}

function NowPlaying({ frame, state, colourway, artworkTone, actor, provider }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly colourway: Colourway; readonly artworkTone: ArtworkTone | null; readonly actor: 'human' | 'agent'; readonly provider: MusicProvider }) {
  const mode = useAtomValue(nowPlayingModeAtom)
  const sampledArtwork = useAtomValue(sampledArtworkAtom)
  const setSampledArtwork = useSetAtom(sampledArtworkAtom)
  const success = useAtomValue(successResultAtom)
  const setSuccess = useSetAtom(successResultAtom)
  const lovedTrackKey = useAtomValue(lovedTrackKeyAtom)
  const setLovedTrackKey = useSetAtom(lovedTrackKeyAtom)
  useSyncExternalStore(provider.onPlaybackChange, () => JSON.stringify(provider.playback), () => JSON.stringify(provider.playback))
  useSyncExternalStore(provider.onProgress, () => `${provider.playback.positionMs}/${provider.playback.durationMs}`, () => `0/${provider.playback.durationMs}`)
  const playback = provider.playback
  const progressTick = { positionMs: playback.positionMs, durationMs: playback.durationMs }
  const track = playback.now
  const queue = playbackQueueForFrame(frame)
  const art = track === null ? null : sharpArtwork(track, 176)
  const artUrl = art?.url ?? null
  useEffect(() => isClockDrivenProvider(provider) ? acquirePlaybackClock(document, provider, {
    now: () => performance.now(),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    clearInterval: (handle) => window.clearInterval(handle),
  }) : undefined, [provider])
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
      await provider.setVolume(actor === 'human' ? 72 : 68)
      return { screenId: 'S13', text: 'Volume changed.', objectKey: 'playback.volume' }
    })
    void operation.then((result) => { if (live) setSuccess(result) })
    return () => { live = false }
  }, [actor, provider, setSuccess, state])
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
  if (state === 'loading' || playback.status === 'loading') return <section className="wp-screen" aria-busy="true"><TitleBar title="Now Playing" /><span className="wp-sr-only">Loading the song.</span><div className="wp-now-loading"><Artwork state="loading" /><i /><i /><i /></div></section>
  if (state === 'permission-denied') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Playback needs an Apple Music subscription." detail="Learn more · Browse anyway" /></section>
  if (state === 'error' || playback.status === 'error') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message={track === null ? "Couldn't start playback." : `Couldn't play “${track.title}”.`} detail="Press Menu and try again." /></section>
  if (state === 'empty' || track === null) return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelEmpty title="Nothing is playing." detail="Choose a song or press Menu to go back." /></section>
  const loveTrack = async () => {
    await provider.ratingSet(track, { love: 'love' })
    setLovedTrackKey(track.key)
  }
  const currentQueueIndex = queue === null ? -1 : playbackQueueIndex(queue, track, playback.queueIndex)
  const queueIndex = currentQueueIndex < 0 || queue === null ? undefined : `${currentQueueIndex + 1} of ${queue.tracks.length}`
  return (
    <section className="wp-screen wp-now" aria-label="Now Playing" data-art-tone={artworkTone ?? 'provider'} data-art-sample-source={artworkTone === null ? samples === null ? 'pending' : 'provider' : 'fixture'} data-volume={playback.volume0to100} data-position-ms={playback.positionMs} style={artStyle}>
      <TitleBar title="Now Playing" index={queueIndex} />
      <div className="wp-now-body">
        <Artwork state="ready" large tone={artworkTone} track={track} />
        <div className="wp-now-meta">
          <h1>{track.title}</h1>
          <p>{track.artistName}</p>
          <p>{track.albumName ?? 'Unknown album'}</p>
          {queue?.sourceLabel === null || queue?.sourceLabel === undefined ? null : <span className="wp-source">{queue.sourceLabel}</span>}
          <span className="wp-mode-chip">{mode}</span>
        </div>
        <div className="wp-progress" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <i style={{ inlineSize: `${progress}%` }} />
        </div>
        <div className="wp-times"><span>{formatTime(progressTick.positionMs)}</span><span>-{formatTime(Math.max(0, progressTick.durationMs - progressTick.positionMs))}</span></div>
        <div className="wp-actions" role="group" aria-label="Playback status">
          <PassiveStatusIcon label={`Shuffle ${playback.shuffle}`}><PanelIcon name="shuffle" /></PassiveStatusIcon>
          <PassiveStatusIcon label={`Repeat ${playback.repeat}`}><PanelIcon name="repeat" /></PassiveStatusIcon>
          <button type="button" aria-label="Love track" aria-pressed={lovedTrackKey === track.key} onClick={() => { void loveTrack() }}><span aria-hidden="true"><PanelIcon name="heart" /></span></button>
          <PassiveStatusIcon label="Rate"><PanelIcon name="star" /></PassiveStatusIcon>
          <PassiveStatusIcon label="Queue"><PanelIcon name="queue" /></PassiveStatusIcon>
        </div>
        {state === 'offline' ? <span className="wp-state-note">Offline. Playback unavailable; cached metadata shown.</span> : null}
        {state === 'agent-active' ? <span className="wp-state-note wp-agent-note">Assistant moved here</span> : null}
        {success?.screenId === 'S13' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
      </div>
    </section>
  )
}

function sameProviderTrack(left: TrackRef, right: TrackRef): boolean {
  return left.key === right.key || (left.provider === right.provider && left.catalogId === right.catalogId)
}

function playbackQueueIndex(queue: NonNullable<ReturnType<typeof playbackQueueForFrame>>, track: TrackRef, liveIndex: number | null): number {
  const liveTrack = liveIndex === null || !Number.isInteger(liveIndex) || liveIndex < 0 || liveIndex >= queue.tracks.length ? undefined : queue.tracks[liveIndex]
  if (liveIndex !== null && liveTrack !== undefined && sameProviderTrack(liveTrack, track)) return liveIndex
  const selectedIndex = queue.startIndex
  const selected = selectedIndex === null ? undefined : queue.tracks[selectedIndex]
  if (selectedIndex !== null && selected !== undefined && sameProviderTrack(selected, track)) return selectedIndex
  return queue.tracks.findIndex((item) => sameProviderTrack(item, track))
}

function PassiveStatusIcon({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <span role="img" aria-label={label}><span aria-hidden="true">{children}</span></span>
}

function FooterReceipt({ children }: { readonly children: ReactNode }) {
  return <div className="wp-footer-receipt" role="status">{children}</div>
}

function Artwork({ state, large = false, tone, variant = 'provider', track }: { readonly state: PanelState; readonly large?: boolean; readonly tone?: ArtworkTone | null; readonly variant?: 'menu' | 'provider'; readonly track?: TrackRef }) {
  if (state === 'loading') return <span className={large ? 'wp-art wp-art--large wp-skeleton' : 'wp-art wp-skeleton'} aria-hidden="true" />
  const art = sharpArtwork(track ?? currentTrack(), large ? 176 : 88)
  const fixtureSurface = tone === 'pale'
    ? 'linear-gradient(145deg, rgb(250 240 214), rgb(218 188 142))'
    : tone === 'dark'
      ? 'linear-gradient(145deg, rgb(49 35 69), rgb(12 10 20))'
      : null
  const authoredArtwork = variant === 'menu' ? menuArtworkUrl : null
  const artworkUrl = authoredArtwork ?? art?.url ?? null
  return (
    <span className={large ? 'wp-art wp-art--large' : 'wp-art'} style={{ '--wp-art-max': `${authoredArtwork === null ? art?.renderedPx ?? 104 : 352}px`, backgroundImage: fixtureSurface ?? (artworkUrl === null ? undefined : `url(${artworkUrl}), var(--wp-art-fallback, linear-gradient(145deg, #334155, #0b0d11))`) } as CSSProperties}>
      {tone === null && artworkUrl !== null ? <img src={artworkUrl} alt="" data-provider-artwork={authoredArtwork === null ? 'true' : undefined} data-authored-artwork={authoredArtwork === null ? undefined : variant} /> : null}
      {artworkUrl === null ? <span className="wp-art__fallback" aria-hidden="true">◒</span> : null}
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

const isClockDrivenProvider = (provider: MusicProvider): provider is FixtureProvider => 'tick' in provider && typeof provider.tick === 'function'

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
