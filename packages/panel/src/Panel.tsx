import { Provider, atom, useAtomValue, useSetAtom } from 'jotai'
import { artworkUrl, type Artwork, type Entity, type FixtureProvider, type MusicProvider, type PlaybackState, type QueueSnapshot, type TrackRef } from '@webpod/providers'
import {
  currentScreenAtom,
  detentActionAtom,
  deviceStore,
  dismissNowPlayingVolumeFeedbackActionAtom,
  effectiveDensityAtom,
  liveRegionAtom,
  navigationIntentAtom,
  nowPlayingModeAtom,
  nowPlayingVolumeFeedbackAtom,
  nowPlayingWheelControlAtom,
  nowPlayingWheelIntentAtom,
  pressActionAtom,
  pushScreenActionAtom,
  resetStackActionAtom,
  screenStackAtom,
  setDynamicTypeScaleActionAtom,
  setDensityActionAtom,
  setNowPlayingModeActionAtom,
  setNowPlayingWheelControlActionAtom,
  visibleRowCountAtom,
  VISIBLE_ROWS,
  type Density,
  type ScreenFrame,
} from '@webpod/state'
import { useEffect, useId, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react'

import {
  artworkSampleFixture,
  deriveArtworkTreatment,
  formatDuration,
  nowPlayingFrame,
  previewNowPlayingScrub,
  settleNowPlayingQueue,
  settleNowPlayingScrub,
  transitionNowPlayingCenter,
  type Colourway,
  type ArtworkTone,
  type NowPlayingCenterState,
  type PanelState,
} from './model'
import { isNavigationLoadingFrame, navigationLoadingRequestId, navigationRoot, preparationForFrame, providerStatusFrame, refreshNavigationFrame, selectNavigationImmediate, statusFrame, type NavigationDataSource, type NavigationStatus } from './navigation'
import { acquireAnnouncer, acquireNowPlayingVolumeFeedback, acquirePlaybackClock, acquireStableSelection, sampleProviderArtwork, type ArtworkSamples } from './runtime'
import { BoundedAsyncCache } from './bounded-async-cache'
import { ListViewport, type ListRowContent } from './list-view'
import { OverflowMarquee } from './overflow-marquee'
import { derivePlaybackPresentation, playbackFrameKey, type PlaybackAttempt, type PlaybackPresentation } from './playback-presentation'
import './panel.css'

interface PlaybackObservation {
  readonly provider: MusicProvider | null
  readonly playback: PlaybackState | null
}

const sampledArtworkAtom = atom<{ readonly url: string; readonly samples: ArtworkSamples } | null>(null)
const successResultAtom = atom<SuccessResult | null>(null)
const playbackAttemptAtom = atom<PlaybackAttempt | null>(null)
const playbackObservationAtom = atom<PlaybackObservation>({ provider: null, playback: null })
const playbackPresentationAtom = atom((get): PlaybackPresentation | null => {
  const frame = get(currentScreenAtom)
  const observation = get(playbackObservationAtom)
  if (frame === null || observation.provider === null || observation.playback === null) return null
  return derivePlaybackPresentation(frame, get(playbackAttemptAtom), observation.playback, observation.provider)
})
const handledNowPlayingWheelIntentAtom = atom(0)
const queueViewAtom = atom<QueueViewState>({ provider: null, status: 'idle', items: [], currentIndex: -1 })
export const searchQueryAtom = atom('')
let initializedDocument: Document | null = null
let initializedProvider: MusicProvider | null = null
let initializedSource: NavigationDataSource | null = null
let initializedSession: MusicProvider['session'] | undefined
let initializedAccountStatus: NavigationStatus | null | undefined
const libraryCountLabels = new Set(['Playlists', 'Artists', 'Albums', 'Songs', 'Genres'])
const successOperations = new WeakMap<Document, Map<string, Promise<SuccessResult>>>()
const artworkRequests = new BoundedAsyncCache<ArtworkSamples>({ maxEntries: 48, ttlMs: 10 * 60 * 1_000 })
const handledNavigationSeq = new WeakMap<Document, number>()
const nowPlayingWrites = new WeakMap<MusicProvider, Promise<void>>()
let playbackAttemptSequence = 0
let queueReadSequence = 0
const subscribeToStaticSource = (): (() => void) => () => {}
const staticSourceRevision = (): number => 0

/** Brings provider-owned transport back into view without creating a second UI store. */
export function showNowPlayingScreen(): void {
  if (deviceStore.get(currentScreenAtom)?.route?.kind === 'now-playing') return
  deviceStore.set(pushScreenActionAtom, nowPlayingFrame())
}

/** Observes transitions into the root without moving provider ownership into navigation state. */
export function subscribeToRootScreenEntry(listener: () => void): () => void {
  const isAtRoot = (): boolean => deviceStore.get(screenStackAtom).at(-1)?.route?.kind === 'root'
  let wasRoot = isAtRoot()
  return deviceStore.sub(screenStackAtom, () => {
    const isRoot = isAtRoot()
    if (isRoot && !wasRoot) listener()
    wasRoot = isRoot
  })
}

function cachedArtworkSamples(url: string, priority: 'low' | 'high' = 'high'): Promise<ArtworkSamples> {
  return artworkRequests.get(url, priority, (signal, requestPriority) => sampleProviderArtwork(url, signal, requestPriority))
}

interface SuccessResult {
  readonly screenId: 'S03' | 'S08' | 'S13'
  readonly text: string
  readonly objectKey: string
  readonly libraryTotal?: number
}

interface QueueViewState {
  readonly provider: MusicProvider | null
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly items: readonly TrackRef[]
  readonly currentIndex: number
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
  readonly provider: MusicProvider
  readonly navigationSource: NavigationDataSource
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
  provider,
  navigationSource,
  accountStatus,
}: PanelProps) {
  const session = useSyncExternalStore(provider.onSessionChange, () => provider.session, () => provider.session)
  const sourceRevision = useSyncExternalStore(
    navigationSource.subscribe ?? subscribeToStaticSource,
    navigationSource.getRevision ?? staticSourceRevision,
    navigationSource.getRevision ?? staticSourceRevision,
  )
  const rasterScale = Math.min(1.25, Math.max(1, dynamicTypeScale))
  useEffect(() => {
    const accountFrame = accountStatus === undefined ? providerStatusFrame(provider) : accountStatus === null ? null : statusFrame(accountStatus, provider.displayName)
    const sourceChanged = initializedDocument !== document || initializedProvider !== provider || initializedSource !== navigationSource || initializedSession !== session || initializedAccountStatus !== accountStatus
    if (sourceChanged) {
      deviceStore.set(resetStackActionAtom, [accountFrame ?? navigationRoot(navigationSource, provider)])
      deviceStore.set(playbackAttemptAtom, null)
      initializedDocument = document
      initializedProvider = provider
      initializedSource = navigationSource
      initializedSession = session
      initializedAccountStatus = accountStatus
    } else if (accountFrame === null) {
      const stack = deviceStore.get(screenStackAtom)
      const refreshed = stack.map((frameValue) => refreshNavigationFrame(frameValue, navigationSource, provider))
      if (refreshed.some((frameValue, index) => frameValue !== stack[index])) deviceStore.set(screenStackAtom, refreshed)
    }
    deviceStore.set(setDensityActionAtom, density)
    deviceStore.set(setDynamicTypeScaleActionAtom, dynamicTypeScale)
  }, [accountStatus, actor, density, dynamicTypeScale, navigationSource, provider, session, sourceRevision, state])
  useEffect(() => {
    const publishPlayback = (): void => {
      deviceStore.set(playbackObservationAtom, { provider, playback: provider.playback })
    }
    publishPlayback()
    const stopPlayback = provider.onPlaybackChange(publishPlayback)
    const stopProgress = provider.onProgress(publishPlayback)
    return () => {
      stopProgress()
      stopPlayback()
    }
  }, [provider])
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
  const press = useSetAtom(pressActionAtom)
  const setPlaybackAttempt = useSetAtom(playbackAttemptAtom)
  const navigationIntent = useAtomValue(navigationIntentAtom)
  const visibleRows = useAtomValue(visibleRowCountAtom)
  const density = useAtomValue(effectiveDensityAtom)
  const visibleMode = useAtomValue(nowPlayingModeAtom)
  const visibleQueue = useAtomValue(queueViewAtom)
  const visibleWheelControl = useAtomValue(nowPlayingWheelControlAtom)
  const queueIndex = visibleWheelControl?.kind === 'queue' ? Math.round(visibleWheelControl.value) : visibleQueue.currentIndex
  const isQueue = frame?.screenId === 'S13' && visibleMode.frame === frame && visibleMode.mode === 'queue'
  const hasListRows = frame !== null && frame.screenId !== 'S13' && frame.route?.kind !== 'status'
    && (frame.screenId === 'S03' || (!isNavigationLoadingFrame(frame) && !['loading', 'empty', 'error', 'permission-denied'].includes(state)))
  const activeDescendant = isQueue
    ? visibleQueue.provider === provider && visibleQueue.status === 'ready' && queueIndex >= 0 && queueIndex < visibleQueue.items.length ? `${panelId}-queue-row-${queueIndex}` : undefined
    : hasListRows && frame.highlightIndex >= 0 && frame.rows.length > 0 ? `${panelId}-row-${frame.highlightIndex}` : undefined
  const preparationIntentKey = frame === null ? null : preparationForFrame(frame, navigationSource)?.key ?? null
  useEffect(() => acquireAnnouncer(document, deviceStore), [])
  useEffect(() => acquireNowPlayingVolumeFeedback(document, deviceStore), [])
  useEffect(() => {
    if (preparationIntentKey === null) return
    return acquireStableSelection(provider, preparationIntentKey, async (signal) => {
      const currentFrame = deviceStore.get(currentScreenAtom)
      if (currentFrame === null) return
      const selected = preparationForFrame(currentFrame, navigationSource)
      if (selected === null || selected.key !== preparationIntentKey || signal.aborted) return
      const work: Promise<unknown>[] = [selected.prefetchData()]
      if (selected.artwork !== null) {
        const resolved = artworkUrl(selected.artwork, 176)
        work.push(cachedArtworkSamples(resolved.url, 'low'))
      }
      if (selected.playTarget !== null) work.push(provider.prepare(selected.playTarget, signal))
      await Promise.all(work)
    })
  }, [navigationSource, preparationIntentKey, provider])
  useEffect(() => {
    if (navigationIntent === null || navigationIntent.seq <= (handledNavigationSeq.get(document) ?? 0)) return
    handledNavigationSeq.set(document, navigationIntent.seq)
    if (navigationIntent.kind !== 'select' || frame === null) return
    if (frame.route?.kind === 'now-playing') {
      const modeState = deviceStore.get(nowPlayingModeAtom)
      const currentState: NowPlayingCenterState = modeState.frame === frame
        ? modeState
        : { mode: 'standard', scrub: 'clean', scrubRevision: 0, queue: 'clean' }
      const queueView = deviceStore.get(queueViewAtom)
      const wheelControl = deviceStore.get(nowPlayingWheelControlAtom)
      const queueIndex = wheelControl?.kind === 'queue'
        ? Math.round(wheelControl.value)
        : queueView.currentIndex
      const queueSelectionPending = currentState.mode === 'queue'
        && queueView.provider === provider
        && queueView.status === 'ready'
        && queueIndex >= 0
        && queueIndex < queueView.items.length
        && queueIndex !== queueView.currentIndex
      const transition = transitionNowPlayingCenter(currentState, provider, queueSelectionPending)
      deviceStore.set(setNowPlayingModeActionAtom, { frame, ...transition.state })
      if (transition.effect === 'commit-scrub') {
        const control = deviceStore.get(nowPlayingWheelControlAtom)
        const committedRevision = transition.state.scrubRevision
        if (control?.kind !== 'scrub') {
          deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingScrub(transition.state, committedRevision, false) })
          return
        }
        void enqueueNowPlayingWrite(provider, () => provider.seek(control.value)).then(
          () => {
            const latest = deviceStore.get(nowPlayingModeAtom)
            if (latest.frame !== frame) return
            deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingScrub(latest, committedRevision, true) })
          },
          () => {
            const latest = deviceStore.get(nowPlayingModeAtom)
            if (latest.frame !== frame || latest.scrubRevision !== committedRevision) return
            const playbackNow = provider.playback
            deviceStore.set(setNowPlayingWheelControlActionAtom, { kind: 'scrub', value: playbackNow.positionMs, minimum: 0, maximum: playbackNow.durationMs, step: 5_000 })
            deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingScrub(latest, committedRevision, false) })
          },
        )
      }
      if (transition.effect === 'select-queue') {
        if (!queueSelectionPending) {
          deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingQueue(transition.state) })
          return
        }
        const target = { kind: 'tracks' as const, tracks: queueView.items.slice(queueIndex), startIndex: 0 }
        void enqueueNowPlayingWrite(provider, () => provider.play(target)).then(
          () => {
            const latest = deviceStore.get(nowPlayingModeAtom)
            if (latest.frame !== frame) return
            deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingQueue(latest) })
          },
          () => {
            const latest = deviceStore.get(nowPlayingModeAtom)
            if (latest.frame !== frame) return
            deviceStore.set(setNowPlayingModeActionAtom, { frame, ...settleNowPlayingQueue(latest) })
          },
        )
      }
      return
    }
    const selection = selectNavigationImmediate(frame, navigationSource, provider, deviceStore.get(searchQueryAtom))
    if (selection.frame === null) return
    const selectedFrame = selection.frame
    push(selectedFrame)
    if (selection.resolution !== undefined) {
      void selection.resolution.then((resolved) => replacePendingFrame(selectedFrame, resolved)).catch(() => replacePendingFrame(selectedFrame, statusFrame('error')))
    }
    if (selection.playback !== undefined) {
      const id = ++playbackAttemptSequence
      const frameKey = playbackFrameKey(selectedFrame)
      setPlaybackAttempt({ id, provider, frameKey, status: 'pending' })
      void selection.playback.then(
        () => {
          const current = deviceStore.get(playbackAttemptAtom)
          if (current?.id === id) deviceStore.set(playbackAttemptAtom, { id, provider, frameKey, status: 'resolved' })
        },
        () => {
          const current = deviceStore.get(playbackAttemptAtom)
          if (current?.id === id) deviceStore.set(playbackAttemptAtom, { id, provider, frameKey, status: 'rejected' })
        },
      )
    }
  }, [frame, navigationIntent, navigationSource, provider, push, setPlaybackAttempt])
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
      press({ button: 'menu', source: 'human', path: 'key' })
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
      aria-activedescendant={activeDescendant}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className="wp-sr-only" aria-live="polite" aria-atomic="true" data-announcement-seq={announcement?.seq}>
        {announcement?.text ?? ''}
      </span>
      {frame === null ? <PanelError message="The player is starting." /> : renderScreen(frame, state, colourway, artworkTone, visibleRows, actor, panelId, provider, navigationSource)}
    </div>
  )
}

function renderScreen(frame: ScreenFrame, state: PanelState, colourway: Colourway, artworkTone: ArtworkTone | null, visibleRows: number, actor: 'human' | 'agent', panelId: string, provider: MusicProvider, navigationSource: NavigationDataSource) {
  if (frame.screenId === 'S03') return <MainMenu frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} navigationSource={navigationSource} provider={provider} />
  if (frame.route?.kind === 'album-tracks' || frame.route?.kind === 'playlist-tracks') return <NestedTrackList frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} provider={provider} navigationSource={navigationSource} />
  if (frame.screenId === 'S13') return <NowPlaying panelId={panelId} frame={frame} state={state} colourway={colourway} artworkTone={artworkTone} actor={actor} provider={provider} />
  if (frame.route?.kind === 'status') return <StatusScreen frame={frame} />
  return <BrowserList frame={frame} state={state} visibleRows={visibleRows} panelId={panelId} provider={provider} />
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

type PanelIconName = 'battery' | 'chevron' | 'pending' | 'warning' | 'lock' | 'offline' | 'agent' | 'check' | 'play' | 'pause'

function PanelIcon({ name }: { readonly name: PanelIconName }) {
  const paths: Record<PanelIconName, ReactNode> = {
    battery: <><rect x="2" y="5" width="15" height="8" rx="1.5" /><path d="M19 8v2" /><path d="M4.5 7.5h8.5v3H4.5z" className="wp-icon-fill" /></>,
    chevron: <path d="m8 5 5 5-5 5" />,
    pending: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.7 1.7" /></>,
    warning: <><path d="m10 3 7 13H3Z" /><path d="M10 7.2v4.3M10 14v.1" /></>,
    lock: <><rect x="4" y="8" width="12" height="9" rx="1.5" /><path d="M7 8V6a3 3 0 0 1 6 0v2" /></>,
    offline: <><path d="M3.5 8.7a9.8 9.8 0 0 1 13 0M6.2 11.4a5.9 5.9 0 0 1 7.6 0M8.7 14a2 2 0 0 1 2.6 0" /><path d="m3 3 14 14" /></>,
    agent: <><path d="m10 2 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" /><path d="m15 3 .7 1.8 1.8.7-1.8.7L15 8l-.7-1.8-1.8-.7 1.8-.7Z" /></>,
    check: <><circle cx="10" cy="10" r="7" /><path d="m6.5 10 2.2 2.2 4.8-5" /></>,
    play: <path d="m6 4 10 6-10 6Z" className="wp-icon-fill" />,
    pause: <><rect x="5" y="4" width="3" height="12" className="wp-icon-fill" /><rect x="12" y="4" width="3" height="12" className="wp-icon-fill" /></>,
  }
  return <svg className={`wp-icon wp-icon--${name}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

type TitleBarTransport = 'starting' | 'playing' | 'paused'

function TitleBar({ title, index, transport }: { readonly title: string; readonly index?: string; readonly transport?: TitleBarTransport | null }) {
  const transportLabel = transport === 'starting'
    ? 'Playback starting'
    : transport === 'paused'
      ? 'Playback paused'
      : 'Playback playing'
  return (
    <header className="wp-titlebar">
      {transport == null
        ? <span className="wp-titlebar__side">{index ?? ''}</span>
        : <span className="wp-titlebar__side wp-titlebar__transport" data-transport={transport} role="img" aria-label={transportLabel}><PanelIcon name={transport === 'paused' ? 'pause' : 'play'} /></span>}
      <strong>{title}</strong>
      <span className="wp-titlebar__side wp-titlebar__battery" role="img" aria-label="Battery full"><span className="wp-battery"><i /></span></span>
    </header>
  )
}

/** Keeps the native transport indicator visible while browsing the library. */
function BrowsingTitleBar({ title, index, provider }: { readonly title: string; readonly index?: string; readonly provider: MusicProvider }) {
  const observation = useAtomValue(playbackObservationAtom)
  const playback = observation.provider === provider && observation.playback !== null ? observation.playback : provider.playback
  const transport = playback.now !== null && (playback.status === 'playing' || playback.status === 'paused') ? playback.status : null
  return <TitleBar title={title} index={index} transport={transport} />
}

function MainMenu({ frame, state, visibleRows, panelId, navigationSource, provider }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string; readonly navigationSource: NavigationDataSource; readonly provider: MusicProvider }) {
  const success = useLibrarySuccess('S03', frame.title, state, provider, navigationSource)
  void navigationSource
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({
    index: row.index,
    primary: row.label,
    count: state === 'ready' || state === 'offline' || state === 'agent-active' || state === 'success-confirmation' ? row.sublabel : null,
    chevron: <PanelIcon name="chevron" />,
    unavailable: (state === 'offline' && (row.label === 'Radio' || row.label === 'Search')) || (state === 'permission-denied' && row.label === 'Radio'),
    empty: state === 'empty' && libraryCountLabels.has(row.label),
    success: success?.screenId === 'S03' && row.label === 'Playlists',
  }))
  return (
    <div className="wp-screen">
      <BrowsingTitleBar title={frame.title} provider={provider} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label="Music categories" panelId={panelId} />
      {state === 'empty' ? <FooterReceipt>Nothing in your library yet. Try Radio, or search for anything.</FooterReceipt> : null}
      {state === 'offline' ? <FooterReceipt>Offline. Showing cached library metadata.</FooterReceipt> : null}
      {state === 'permission-denied' ? <FooterReceipt>Browsing only — a subscription is needed to play.</FooterReceipt> : null}
      {success?.screenId === 'S03' ? <FooterReceipt>{success.text}</FooterReceipt> : null}
      {state === 'loading' ? <span className="wp-sr-only">Loading your library counts.</span> : null}
    </div>
  )
}

function BrowserList({ frame, state, visibleRows, panelId, provider }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string; readonly provider: MusicProvider }) {
  const query = useAtomValue(searchQueryAtom)
  const setQuery = useSetAtom(searchQueryAtom)
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({ index: row.index, primary: row.label, secondary: frame.route?.kind === 'songs' ? undefined : row.sublabel, chevron: row.glyphs.includes('descend') ? <PanelIcon name="chevron" /> : undefined, unavailable: state === 'offline' }))
  const loading = state === 'loading' || isNavigationLoadingFrame(frame)
  const message = listStateMessage(frame, loading ? 'loading' : state, visibleRows)
  const search = frame.route?.kind === 'search-entry' ? <label className="wp-search-field"><span>Search Query</span><input name="music-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Artists, albums, songs…" autoComplete="off" /></label> : undefined
  return (
    <section className="wp-screen wp-browser-list" aria-label={frame.title} aria-busy={loading}>
      <BrowsingTitleBar title={frame.title} provider={provider} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label={frame.title} panelId={panelId} preview={search} message={message} />
      {state === 'offline' ? <FooterReceipt>Offline. Showing cached library metadata.</FooterReceipt> : null}
    </section>
  )
}

function NestedTrackList({ frame, state, visibleRows, panelId, provider, navigationSource }: { readonly frame: ScreenFrame; readonly state: PanelState; readonly visibleRows: number; readonly panelId: string; readonly provider: MusicProvider; readonly navigationSource: NavigationDataSource }) {
  const success = useLibrarySuccess('S08', frame.title, state, provider, navigationSource)
  const rows: readonly ListRowContent[] = frame.rows.map((row) => ({ index: row.index, primary: row.label, secondary: state === 'offline' ? '☁︎' : undefined, unavailable: state === 'offline', agent: state === 'agent-active' && row.index === frame.highlightIndex, success: success !== null && row.index === frame.highlightIndex }))
  const loading = state === 'loading' || isNavigationLoadingFrame(frame)
  return (
    <section className="wp-screen" aria-label="Album tracks" aria-busy={loading} data-success-object={success?.objectKey} data-library-total={success?.libraryTotal}>
      <BrowsingTitleBar title={frame.title} provider={provider} index={state === 'offline' ? 'Cached metadata' : undefined} />
      <ListViewport rows={rows} highlightIndex={frame.highlightIndex} windowStart={frame.windowStart} visibleRows={visibleRows} label={`${frame.title} tracks`} panelId={panelId} message={listStateMessage(frame, loading ? 'loading' : state, visibleRows, 'Nothing here plays in your region.', 'Search for it · Go to artist')} />
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

function NowPlaying({ panelId, frame, state, colourway, artworkTone, actor, provider }: { readonly panelId: string; readonly frame: ScreenFrame; readonly state: PanelState; readonly colourway: Colourway; readonly artworkTone: ArtworkTone | null; readonly actor: 'human' | 'agent'; readonly provider: MusicProvider }) {
  const modeState = useAtomValue(nowPlayingModeAtom)
  const mode = modeState.frame === frame ? modeState.mode : 'standard'
  const scrubState = modeState.frame === frame ? modeState.scrub : 'clean'
  const queueState = modeState.frame === frame ? modeState.queue : 'clean'
  const playbackAttempt = useAtomValue(playbackAttemptAtom)
  const setPlaybackAttempt = useSetAtom(playbackAttemptAtom)
  const sampledArtwork = useAtomValue(sampledArtworkAtom)
  const setSampledArtwork = useSetAtom(sampledArtworkAtom)
  const setSuccess = useSetAtom(successResultAtom)
  const queueView = useAtomValue(queueViewAtom)
  const setQueueView = useSetAtom(queueViewAtom)
  const wheelControl = useAtomValue(nowPlayingWheelControlAtom)
  const wheelIntent = useAtomValue(nowPlayingWheelIntentAtom)
  const volumeFeedback = useAtomValue(nowPlayingVolumeFeedbackAtom)
  const handledWheelIntentSeq = useAtomValue(handledNowPlayingWheelIntentAtom)
  const setHandledWheelIntentSeq = useSetAtom(handledNowPlayingWheelIntentAtom)
  const configureWheel = useSetAtom(setNowPlayingWheelControlActionAtom)
  const dismissVolumeFeedback = useSetAtom(dismissNowPlayingVolumeFeedbackActionAtom)
  const playbackObservation = useAtomValue(playbackObservationAtom)
  const observedPresentation = useAtomValue(playbackPresentationAtom)
  const presentation = observedPresentation === null || playbackObservation.provider !== provider
    ? derivePlaybackPresentation(frame, playbackAttempt, provider.playback, provider)
    : observedPresentation
  const { playback, track } = presentation
  const occurrenceIdentity = playbackOccurrenceIdentity(playback, track)
  const progressTick = presentation.phase === 'starting' && presentation.usesSelectedTrack
    ? { positionMs: 0, durationMs: track?.durationMs ?? 0 }
    : { positionMs: playback.positionMs, durationMs: playback.durationMs }
  const art = resolvedArtwork(track, 176)
  const artUrl = art?.url ?? null
  useEffect(() => isClockDrivenProvider(provider) ? acquirePlaybackClock(document, provider, {
    now: () => performance.now(),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    clearInterval: (handle) => window.clearInterval(handle),
  }) : undefined, [provider])
  useEffect(() => {
    if (presentation.settleAttempt) setPlaybackAttempt(null)
  }, [presentation.settleAttempt, setPlaybackAttempt])
  useEffect(() => {
    if (artworkTone !== null || artUrl === null) return
    let live = true
    const request = cachedArtworkSamples(artUrl)
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
    void operation.then((result) => { if (live) setSuccess(result) }).catch(() => undefined)
    return () => { live = false }
  }, [actor, provider, setSuccess, state])
  useEffect(() => {
    if (!provider.supports('queueRead')) return
    const sequence = ++queueReadSequence
    let live = true
    setQueueView({ provider, status: 'loading', items: [], currentIndex: -1 })
    void provider.queueRead().then((snapshot) => {
      if (!live || sequence !== queueReadSequence) return
      setQueueView(queueViewFromSnapshot(provider, snapshot))
    }).catch(() => {
      if (!live || sequence !== queueReadSequence) return
      setQueueView({ provider, status: 'error', items: [], currentIndex: -1 })
    })
    return () => { live = false }
  }, [mode, playback.now?.key, playback.queueIndex, provider, setQueueView])
  useEffect(() => {
    if (mode !== 'standard') return
    configureWheel(provider.supports('volume')
      ? { kind: 'volume', value: playback.volume0to100, minimum: 0, maximum: 100, step: 2, occurrenceIdentity: occurrenceIdentity ?? undefined }
      : null)
  }, [configureWheel, mode, occurrenceIdentity, playback.volume0to100, provider])
  useEffect(() => {
    if (mode !== 'scrub') return
    if (!provider.supports('seek') || playback.durationMs <= 0) {
      configureWheel(null)
      return
    }
    const currentControl = deviceStore.get(nowPlayingWheelControlAtom)
    const pendingScrubIntent = wheelIntent?.kind === 'scrub'
      && wheelIntent.seq > handledWheelIntentSeq
    const value = (scrubState === 'clean' && !pendingScrubIntent) || currentControl?.kind !== 'scrub'
      ? playback.positionMs
      : Math.min(playback.durationMs, Math.max(0, currentControl.value))
    configureWheel({ kind: 'scrub', value, minimum: 0, maximum: playback.durationMs, step: 5_000 })
  }, [configureWheel, handledWheelIntentSeq, mode, playback.durationMs, playback.positionMs, provider, scrubState, wheelIntent])
  useEffect(() => {
    if (mode === 'artwork') {
      configureWheel(null)
      return
    }
    if (mode !== 'queue') return
    configureWheel(queueView.provider === provider && queueView.status === 'ready' && queueView.items.length > 0
      ? { kind: 'queue', value: queueView.currentIndex, minimum: 0, maximum: queueView.items.length - 1, step: 1 }
      : null)
  }, [configureWheel, mode, provider, queueView])
  useEffect(() => () => configureWheel(null), [configureWheel])
  useEffect(() => {
    if (wheelIntent === null || wheelIntent.seq <= handledWheelIntentSeq) return
    setHandledWheelIntentSeq(wheelIntent.seq)
    const activeControlKind = mode === 'standard' ? 'volume' : mode
    if (wheelIntent.kind !== activeControlKind || wheelIntent.kind === 'queue') return
    if (wheelIntent.kind === 'scrub') {
      const currentModeState = deviceStore.get(nowPlayingModeAtom)
      if (currentModeState.frame === frame) deviceStore.set(setNowPlayingModeActionAtom, { frame, ...previewNowPlayingScrub(currentModeState) })
      return
    }
    const work = () => provider.setVolume(wheelIntent.value)
    void enqueueNowPlayingWrite(provider, work).catch(() => {
      const playbackNow = provider.playback
      configureWheel({ kind: 'volume', value: playbackNow.volume0to100, minimum: 0, maximum: 100, step: 2, occurrenceIdentity: playbackOccurrenceIdentity(playbackNow, playbackNow.now) ?? undefined })
    })
  }, [configureWheel, frame, handledWheelIntentSeq, mode, provider, setHandledWheelIntentSeq, wheelIntent])
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
  const playbackFailed = state === 'error' || presentation.phase === 'failed'
  const playbackPending = !playbackFailed && presentation.phase !== 'ready' && (state === 'loading' || presentation.phase === 'starting')
  useEffect(() => {
    if (
      volumeFeedback.visibility === 'visible'
      && volumeFeedback.occurrenceIdentity !== occurrenceIdentity
    ) dismissVolumeFeedback()
  }, [dismissVolumeFeedback, occurrenceIdentity, volumeFeedback])
  useEffect(() => {
    if (
      mode !== 'standard'
      || track === null
      || playbackPending
      || playbackFailed
    ) dismissVolumeFeedback()
  }, [dismissVolumeFeedback, mode, playbackFailed, playbackPending, track])
  const transportState: TitleBarTransport | null = playbackFailed
    ? null
    : playbackPending
      ? 'starting'
      : playback.status === 'paused' || playback.status === 'stopped' || playback.status === 'idle'
        ? 'paused'
        : 'playing'
  if (track === null && playbackPending) return <section className="wp-screen" aria-busy="true" data-playback-phase="starting"><TitleBar title="Now Playing" transport="starting" /><span className="wp-sr-only">Loading the song.</span><div className="wp-now-loading"><Artwork state="loading" item={null} /><i /><i /><i /></div></section>
  if (track === null && state === 'permission-denied') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Playback needs an Apple Music subscription." detail="Learn more · Browse anyway" /></section>
  if (track === null && playbackFailed) return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Playback unavailable." detail="Press Menu to choose another song." /></section>
  if (state === 'empty' || track === null) return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelEmpty title="Nothing is playing." detail="Choose a song or press Menu to go back." /></section>
  if (mode === 'artwork') {
    return (
      <section className="wp-screen wp-now wp-now--artwork" aria-label="Now Playing artwork" data-mode="artwork" style={artStyle}>
        <TitleBar title="Now Playing" transport={transportState} />
        <div className="wp-now-full-artwork"><Artwork state="ready" large tone={artworkTone} item={track} /></div>
      </section>
    )
  }
  if (mode === 'queue') {
    const activeQueueView = queueView.provider === provider
      ? queueView
      : { provider, status: 'loading' as const, items: [], currentIndex: -1 }
    const queueCursor = wheelControl?.kind === 'queue'
      ? Math.round(wheelControl.value)
      : activeQueueView.currentIndex
    const queueRows: readonly ListRowContent[] = activeQueueView.items.map((item, index) => ({
      index,
      leading: index === activeQueueView.currentIndex ? '▶' : index + 1,
      primary: item.title,
      secondary: item.artistName,
    }))
    const windowStart = Math.max(0, Math.min(
      Math.max(0, queueRows.length - VISIBLE_ROWS.compact),
      queueCursor - 3,
    ))
    return (
      <section className="wp-screen wp-now wp-now--queue" aria-label="Now Playing queue" aria-busy={activeQueueView.status === 'loading' || queueState === 'selecting'} data-mode="queue" data-queue-state={queueState} data-wheel-control={wheelControl?.kind} style={artStyle}>
        <TitleBar title="Up Next" transport={transportState} />
        {activeQueueView.status === 'loading'
          ? <div className="wp-list-loading" aria-label="Loading Up Next">{Array.from({ length: VISIBLE_ROWS.compact }, (_, index) => <i className="wp-skeleton" key={index} />)}</div>
          : activeQueueView.status === 'error'
            ? <PanelError message="Couldn’t load Up Next." detail="Press Center and try again." />
            : queueRows.length === 0
              ? <PanelEmpty title="Up Next is empty." detail="Press Center to return." />
              : <ListViewport rows={queueRows} highlightIndex={queueCursor} windowStart={windowStart} visibleRows={VISIBLE_ROWS.compact} label="Up Next" panelId={`${panelId}-queue`} />}
      </section>
    )
  }
  const shownVolume = wheelControl?.kind === 'volume' ? wheelControl.value : playback.volume0to100
  const showVolumeFeedback = volumeFeedback.visibility === 'visible'
    && volumeFeedback.frame === frame
    && mode === 'standard'
    && volumeFeedback.occurrenceIdentity === occurrenceIdentity
    && !playbackPending
    && !playbackFailed
  const durationMs = Number.isFinite(progressTick.durationMs) ? Math.max(0, progressTick.durationMs) : 0
  const rawPositionMs = wheelControl?.kind === 'scrub' ? wheelControl.value : progressTick.positionMs
  const finitePositionMs = Number.isFinite(rawPositionMs) ? Math.max(0, rawPositionMs) : 0
  const shownPosition = Math.min(finitePositionMs, durationMs)
  const shownProgress = durationMs === 0 ? 0 : (shownPosition / durationMs) * 100
  const control = { label: mode === 'scrub' ? 'Track position, scrubbing' : 'Playback position', value: shownPosition, maximum: durationMs, percent: shownProgress, start: formatDuration(shownPosition), end: `-${formatDuration(durationMs - shownPosition)}` }
  return (
    <section className="wp-screen wp-now" aria-label="Now Playing" aria-busy={playbackPending} data-mode={mode} data-wheel-control={wheelControl?.kind} data-scrub-state={mode === 'scrub' ? scrubState : undefined} data-playback-phase={playbackFailed ? 'failed' : playbackPending ? 'starting' : 'ready'} data-playback-indeterminate={playbackPending ? 'true' : undefined} data-art-tone={artworkTone ?? 'provider'} data-art-sample-source={artworkTone === null ? samples === null ? 'pending' : 'provider' : 'fixture'} data-volume={shownVolume} data-position-ms={shownPosition} style={artStyle}>
      <TitleBar title="Now Playing" transport={transportState} />
      <div className="wp-now-body">
        {queueView.provider === provider && queueView.status === 'ready' && queueView.currentIndex >= 0 ? <span className="wp-now-count">{queueView.currentIndex + 1} of {queueView.items.length}</span> : null}
        <div className="wp-now-track">
          <Artwork state="ready" large tone={artworkTone} item={track} />
          <div className="wp-now-meta">
            <h1><OverflowMarquee text={track.title} active /></h1>
            <p>{track.artistName}</p>
            <p>{track.albumName ?? 'Unknown album'}</p>
          </div>
        </div>
        {showVolumeFeedback
          ? <VolumeFeedback value={volumeFeedback.value} />
          : <>
              <div className={`wp-progress${mode === 'scrub' ? ' wp-progress--scrub' : ''}${playbackPending ? ' wp-progress--indeterminate' : ''}`} role="progressbar" aria-label={playbackPending ? 'Loading playback' : control.label} aria-valuemin={playbackPending ? undefined : 0} aria-valuemax={playbackPending ? undefined : control.maximum} aria-valuenow={playbackPending ? undefined : Math.round(control.value)}>
                <i style={{ inlineSize: `${control.percent}%` }} />
                {mode === 'scrub' ? <b style={{ insetInlineStart: `calc(1px + (100% - 2px) * ${control.percent / 100})` }} aria-hidden="true" /> : null}
              </div>
              <span className="wp-now-timing-spacer" aria-hidden="true" />
              {playbackFailed
                ? <p className="wp-now-alert" role="status" aria-live="polite">Playback unavailable</p>
                : <div className="wp-times"><span>{control.start}</span><span>{control.end}</span></div>}
            </>}
      </div>
    </section>
  )
}

function VolumeFeedback({ value }: { readonly value: number }) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div className="wp-volume-feedback" data-volume-feedback="visible">
      <SpeakerGlyph />
      <div
        className="wp-volume-progress"
        role="progressbar"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <i style={{ inlineSize: `${String(percent)}%` }} />
      </div>
      <SpeakerGlyph loud />
    </div>
  )
}

/** Stable provider queue occurrence identity, including duplicate tracks. */
function playbackOccurrenceIdentity(playback: PlaybackState, track: TrackRef | null): string | null {
  return track === null
    ? null
    : JSON.stringify([track.provider, track.catalogId, track.key, playback.queueIndex])
}

function SpeakerGlyph({ loud = false }: { readonly loud?: boolean }) {
  return (
    <svg className="wp-volume-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M1 5h2.5L7 2.2v9.6L3.5 9H1z" />
      {loud ? <><path d="M8.5 4.2c1.4 1.3 1.4 4.3 0 5.6" /><path d="M10.5 2.3c2.5 2.4 2.5 7 0 9.4" /></> : null}
    </svg>
  )
}

function replacePendingFrame(pending: ScreenFrame, resolved: ScreenFrame): void {
  const stack = deviceStore.get(screenStackAtom)
  const visible = stack.at(-1)
  const requestId = navigationLoadingRequestId(pending)
  if (visible === undefined || requestId === null || navigationLoadingRequestId(visible) !== requestId) return
  deviceStore.set(screenStackAtom, [...stack.slice(0, -1), resolved])
}

/** Flattens the provider's authoritative play order without reconstructing it. */
function queueViewFromSnapshot(provider: MusicProvider, snapshot: QueueSnapshot): QueueViewState {
  const items = [...snapshot.history, ...(snapshot.now === null ? [] : [snapshot.now]), ...snapshot.next]
  return {
    provider,
    status: 'ready',
    items,
    currentIndex: snapshot.now === null ? -1 : snapshot.history.length,
  }
}

/** Serializes writes per provider so fast wheel turns cannot complete out of order. */
function enqueueNowPlayingWrite(provider: MusicProvider, write: () => Promise<void>): Promise<void> {
  const prior = nowPlayingWrites.get(provider) ?? Promise.resolve()
  const operation = prior.catch(() => undefined).then(write)
  const settled = operation.then(() => undefined, () => undefined)
  nowPlayingWrites.set(provider, settled)
  void settled.then(() => {
    if (nowPlayingWrites.get(provider) === settled) nowPlayingWrites.delete(provider)
  })
  return operation
}

function FooterReceipt({ children }: { readonly children: ReactNode }) {
  return <div className="wp-footer-receipt" role="status">{children}</div>
}

type ArtworkItem = Entity | { readonly artwork?: Artwork }

function resolvedArtwork(item: ArtworkItem | null, requestedPx: number) {
  if (item === null || !('artwork' in item) || item.artwork === undefined) return null
  const resolved = artworkUrl(item.artwork, requestedPx)
  return { ...resolved, renderedPx: Math.min(requestedPx, resolved.actualPx) }
}

function Artwork({ state, large = false, tone = null, item }: { readonly state: PanelState; readonly large?: boolean; readonly tone?: ArtworkTone | null; readonly item: ArtworkItem | null }) {
  if (state === 'loading') return <span className={large ? 'wp-art wp-art--large wp-skeleton' : 'wp-art wp-skeleton'} aria-hidden="true" />
  const art = resolvedArtwork(item, large ? 176 : 88)
  const fixtureSurface = tone === 'pale'
    ? 'linear-gradient(145deg, rgb(250 240 214), rgb(218 188 142))'
    : tone === 'dark'
      ? 'linear-gradient(145deg, rgb(49 35 69), rgb(12 10 20))'
      : null
  const providerArtworkUrl = art?.url ?? null
  return (
    <span className={large ? 'wp-art wp-art--large' : 'wp-art'} style={{ '--wp-art-max': `${art?.renderedPx ?? 104}px`, backgroundImage: fixtureSurface ?? (providerArtworkUrl === null ? undefined : `url(${providerArtworkUrl}), var(--wp-art-fallback, linear-gradient(145deg, #334155, #0b0d11))`) } as CSSProperties}>
      {tone === null && providerArtworkUrl !== null ? <img src={providerArtworkUrl} alt="" data-provider-artwork="true" /> : null}
      {providerArtworkUrl === null ? <span className="wp-art__fallback" role="img" aria-label="No artwork available">◒</span> : null}
    </span>
  )
}

function useLibrarySuccess(screenId: 'S03' | 'S08', title: string, state: PanelState, provider: MusicProvider, navigationSource: NavigationDataSource): SuccessResult | null {
  const success = useAtomValue(successResultAtom)
  const setSuccess = useSetAtom(successResultAtom)
  useEffect(() => {
    if (state !== 'success-confirmation') return
    let live = true
    const track = provider.playback.now ?? navigationSource.songs[0]
    if (track === undefined) return
    const operation = successOperation(document, screenId, async () => {
      const playlist = await provider.playlistCreate({ name: `${title} Picks`, tracks: [track] })
      const library = await provider.libraryList('playlists')
      return {
        screenId,
        text: `Created “${playlist.name}”.`,
        objectKey: playlist.key,
        ...(library.total === null ? {} : { libraryTotal: library.total }),
      }
    })
    void operation.then((result) => { if (live) setSuccess(result) }).catch(() => undefined)
    return () => { live = false }
  }, [navigationSource, provider, screenId, setSuccess, state, title])
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
