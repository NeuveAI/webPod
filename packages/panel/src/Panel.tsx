import { Provider, atom, useAtomValue, useSetAtom } from 'jotai'
import {
  currentScreenAtom,
  detentActionAtom,
  deviceStore,
  liveRegionAtom,
  popScreenActionAtom,
  pushScreenActionAtom,
  resetStackActionAtom,
  setDynamicTypeScaleActionAtom,
  type ScreenFrame,
} from '@webpod/state'
import { type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import {
  albumTracksFrame,
  currentTrack,
  fixtureProvider,
  mainMenuFrame,
  nextNowPlayingMode,
  nowPlayingFrame,
  sharpArtwork,
  type Colourway,
  type NowPlayingMode,
  type PanelState,
} from './model'
import './panel.css'

const nowPlayingModeAtom = atom<NowPlayingMode>('volume')

deviceStore.set(resetStackActionAtom, [mainMenuFrame()])

export interface PanelProps {
  readonly colourway?: Colourway
  readonly state?: PanelState
  readonly dynamicTypeScale?: number
  readonly className?: string
}

export function Panel({
  colourway = 'dark',
  state = 'ready',
  dynamicTypeScale = 1,
  className,
}: PanelProps) {
  deviceStore.set(setDynamicTypeScaleActionAtom, dynamicTypeScale)
  const rasterScale = Math.min(1.25, Math.max(1, dynamicTypeScale))
  return (
    <div className="wp-panel-stage" style={{ '--wp-raster-scale': rasterScale } as CSSProperties}>
      <Provider store={deviceStore}>
        <PanelSurface colourway={colourway} state={state} className={className} />
      </Provider>
    </div>
  )
}

function PanelSurface({
  colourway,
  state,
  className,
}: {
  readonly colourway: Colourway
  readonly state: PanelState
  readonly className?: string
}) {
  const frame = useAtomValue(currentScreenAtom)
  const announcement = useAtomValue(liveRegionAtom)
  const move = useSetAtom(detentActionAtom)
  const push = useSetAtom(pushScreenActionAtom)
  const pop = useSetAtom(popScreenActionAtom)
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
      select(frame, push)
    }
  }

  return (
    <div
      className={['wp-panel', className].filter(Boolean).join(' ')}
      data-colourway={colourway}
      data-screen={frame?.screenId ?? 'empty'}
      data-state={state}
      tabIndex={0}
      role="application"
      aria-label="webPod music player"
      onKeyDown={onKeyDown}
    >
      <span className="wp-sr-only" aria-live="polite" aria-atomic="true">
        {announcement?.text ?? ''}
      </span>
      {frame === null ? <PanelError message="The player is starting." /> : renderScreen(frame, state)}
    </div>
  )
}

function select(frame: ScreenFrame | null, push: (frame: ScreenFrame) => void) {
  if (frame === null) return
  if (frame.screenId === 'S03') {
    const selected = frame.rows[frame.highlightIndex]
    if (selected?.label === 'Albums') push(albumTracksFrame())
    return
  }
  if (frame.screenId === 'S08') push(nowPlayingFrame())
  if (frame.screenId === 'S13') {
    deviceStore.set(nowPlayingModeAtom, nextNowPlayingMode(deviceStore.get(nowPlayingModeAtom)))
  }
}

function renderScreen(frame: ScreenFrame, state: PanelState) {
  if (frame.screenId === 'S03') return <MainMenu frame={frame} state={state} />
  if (frame.screenId === 'S08') return <AlbumTracks frame={frame} state={state} />
  if (frame.screenId === 'S13') return <NowPlaying state={state} />
  return <PanelError message="This screen is not part of the MVP preview." />
}

function TitleBar({ title, index }: { readonly title: string; readonly index?: string }) {
  return (
    <header className="wp-titlebar">
      <span className="wp-titlebar__side">{index ?? ''}</span>
      <strong>{title}</strong>
      <span className="wp-titlebar__side wp-titlebar__battery" aria-label="Battery full">▰</span>
    </header>
  )
}

function MainMenu({ frame, state }: { readonly frame: ScreenFrame; readonly state: PanelState }) {
  const selected = frame.rows[frame.highlightIndex] ?? null
  return (
    <section className="wp-screen" aria-label="Music menu">
      <TitleBar title={frame.title} />
      <div className="wp-menu-split">
        <ol className="wp-menu-list" aria-label="Music categories">
          {frame.rows.map((row) => (
            <li
              key={row.index}
              className="wp-menu-row"
              aria-current={row.index === frame.highlightIndex ? 'true' : undefined}
            >
              <span>{row.label}</span>
              <span className="wp-row-meta">{state === 'error' ? '—' : row.sublabel}</span>
              <span aria-hidden="true">›</span>
            </li>
          ))}
        </ol>
        <aside className="wp-menu-preview" aria-label={`${selected?.label ?? 'Music'} preview`}>
          <Artwork state={state === 'loading' ? 'loading' : 'ready'} />
          <strong>{selected?.label ?? 'Music'}</strong>
          <span>{state === 'error' ? '—' : selected?.sublabel ?? 'Rotate to browse'}</span>
          <span className="wp-scroll-track" aria-hidden="true"><i /></span>
          {state === 'offline' ? <small>Cached library</small> : null}
          {state === 'agent-active' ? <small className="wp-agent-note">Assistant browsing</small> : null}
        </aside>
      </div>
    </section>
  )
}

function AlbumTracks({ frame, state }: { readonly frame: ScreenFrame; readonly state: PanelState }) {
  const rows = state === 'loading'
    ? Array.from({ length: 8 }, (_, index) => index)
    : frame.rows.slice(frame.windowStart, frame.windowStart + 8)
  return (
    <section className="wp-screen" aria-label="Album tracks" aria-busy={state === 'loading'}>
      <TitleBar title={frame.title} />
      {state === 'error' ? <PanelError message="Couldn't load this album." /> : null}
      {state === 'permission-denied' ? <PanelError message="Sign in to play this album." /> : null}
      {state === 'empty' ? <PanelEmpty title="No songs here." detail="Add music to see it in this album." /> : null}
      {!['error', 'empty', 'permission-denied'].includes(state) ? (
        state === 'loading' || frame.rows.length <= 100
          ? <StaticTrackList rows={rows} frame={frame} state={state} />
          : <VirtualTrackList frame={frame} state={state} />
      ) : null}
      {state === 'success-confirmation' ? <FooterReceipt>Playing {frame.rows[frame.highlightIndex]?.label ?? 'track'}.</FooterReceipt> : null}
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
  const start = Math.max(0, Math.min(frame.highlightIndex - 4, frame.rows.length - 8))
  const rows = frame.rows.slice(start, start + 8)
  return (
    <ol className="wp-track-list" data-windowed="true">
      {rows.map((row, index) => (
        <TrackRow key={row.index} row={row} displayIndex={start + index + 1} frame={frame} state={state} />
      ))}
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
      data-agent={state === 'agent-active' ? 'true' : undefined}
      aria-current={row.index === frame.highlightIndex ? 'true' : undefined}
      style={style}
    >
      <span className="wp-track-number">{displayIndex}</span>
      <span className="wp-track-title">{row.label}</span>
      <span className="wp-row-meta">{row.sublabel}</span>
    </li>
  )
}

function NowPlaying({ state }: { readonly state: PanelState }) {
  const mode = useAtomValue(nowPlayingModeAtom)
  const track = currentTrack()
  const progress = fixtureProvider.playback.durationMs === 0 ? 42 : Math.round(
    (fixtureProvider.playback.positionMs / fixtureProvider.playback.durationMs) * 100,
  )
  if (state === 'loading') return <section className="wp-screen" aria-busy="true"><TitleBar title="Now Playing" /><div className="wp-now-loading"><Artwork state="loading" /><i /><i /></div></section>
  if (state === 'error') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="Couldn't load this song." /></section>
  if (state === 'permission-denied') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelError message="This account can browse but cannot play." /></section>
  if (state === 'empty') return <section className="wp-screen"><TitleBar title="Now Playing" /><PanelEmpty title="Nothing playing." detail="Choose a song from Music." /></section>
  return (
    <section className="wp-screen wp-now" aria-label="Now Playing">
      <TitleBar title="Now Playing" index="1 of 42" />
      <div className="wp-now-body">
        <Artwork state="ready" large />
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
        <div className="wp-times"><span>1:47</span><span>-2:12</span></div>
        <div className="wp-actions" aria-label="Playback status">
          <span aria-label="Shuffle on">⌘</span><span aria-label="Repeat off">↻</span>
          <span aria-label="Loved">♥</span><span aria-label="Rate">★</span><span aria-label="Queue">≡</span>
        </div>
        {state === 'offline' ? <span className="wp-state-note">Cached metadata · audio unavailable</span> : null}
        {state === 'agent-active' ? <span className="wp-state-note wp-agent-note">Assistant moved here</span> : null}
        {state === 'success-confirmation' ? <FooterReceipt>Volume changed.</FooterReceipt> : null}
      </div>
    </section>
  )
}

function FooterReceipt({ children }: { readonly children: ReactNode }) {
  return <div className="wp-footer-receipt" role="status">{children}</div>
}

function Artwork({ state, large = false }: { readonly state: PanelState; readonly large?: boolean }) {
  if (state === 'loading') return <span className={large ? 'wp-art wp-art--large wp-skeleton' : 'wp-art wp-skeleton'} aria-hidden="true" />
  const art = sharpArtwork(currentTrack(), large ? 176 : 88)
  return (
    <span className={large ? 'wp-art wp-art--large' : 'wp-art'} style={{ '--wp-art-max': `${art?.renderedPx ?? 88}px` } as CSSProperties}>
      <span className="wp-art__fallback" aria-hidden="true">◒</span>
    </span>
  )
}

function PanelEmpty({ title, detail }: { readonly title: string; readonly detail: string }) {
  return <div className="wp-message"><strong>{title}</strong><span>{detail}</span></div>
}

function PanelError({ message }: { readonly message: string }) {
  return <div className="wp-message" role="alert"><strong>{message}</strong><span>Press Menu and try again.</span></div>
}
