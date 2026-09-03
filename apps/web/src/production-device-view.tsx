import { CompositeDevice } from '@webpod/composite'
import type {
  DeviceOrientation,
  DeviceOrientationGrabStart,
} from '@webpod/device'
import { Panel, type NavigationStatus, type PanelState } from '@webpod/panel'
import { useCallback, useSyncExternalStore } from 'react'
import { musicRuntime, type MusicRuntimeSnapshot } from './music-runtime'

export type ProductionPanelState = PanelState

interface ProductionPanelViewProps {
  readonly colourway: 'black' | 'white'
  readonly state?: PanelState
  /** Explicit product Dynamic Type setting; the production default is 100%. */
  readonly dynamicTypeScale?: number
}

export interface ProductionDeviceViewProps extends ProductionPanelViewProps {
  readonly className?: string
  readonly cameraFov?: number
  readonly cameraDistance?: number
  readonly cameraSafePadding?: number
  readonly orientation?: DeviceOrientation
  readonly onOrientationGrabStart?: (start: DeviceOrientationGrabStart) => boolean
  readonly onOrientationGrabHoverChange?: (grabbable: boolean) => void
  readonly interactionAudioEnabled?: boolean
}

/** Keeps provider errors attached to the provider that is actually on screen. */
export function accountStatusForRuntime(
  runtime: Pick<MusicRuntimeSnapshot, 'activeMode' | 'phase'>,
): NavigationStatus | null | undefined {
  if (runtime.activeMode === 'fixture') return null
  if (runtime.phase === 'permission-denied') return null
  if (runtime.phase === 'signing-in') return 'loading'
  if (runtime.phase === 'error') return 'error'
  return undefined
}

/**
 * The one production LCD configuration used by every device route.
 *
 * Probe controls may override a documented product state or Dynamic Type
 * setting, but routes do not own independent density, actor, list, or store
 * initialization paths.
 */
export function ProductionPanelView({
  colourway,
  state = 'ready',
  dynamicTypeScale = 1,
}: ProductionPanelViewProps) {
  const runtime = useSyncExternalStore(musicRuntime.subscribe, musicRuntime.getSnapshot, musicRuntime.getSnapshot)
  const accountStatus = accountStatusForRuntime(runtime)
  return (
    <Panel
      colourway={colourway === 'white' ? 'light' : 'dark'}
      state={runtime.phase === 'permission-denied' ? 'permission-denied' : state}
      dynamicTypeScale={dynamicTypeScale}
      density={null}
      actor="human"
      artworkTone={null}
      longList={false}
      provider={runtime.provider}
      navigationSource={runtime.source}
      accountStatus={accountStatus}
    />
  )
}

/** Renders the production panel through the production composite device. */
export function ProductionDeviceView({
  colourway,
  state = 'ready',
  dynamicTypeScale = 1,
  className,
  cameraFov,
  cameraDistance,
  cameraSafePadding,
  orientation,
  onOrientationGrabStart,
  onOrientationGrabHoverChange,
  interactionAudioEnabled,
}: ProductionDeviceViewProps) {
  const onPlayPausePress = useCallback(
    () => toggleProductionPlayback(),
    [],
  )
  return (
    <CompositeDevice
      className={className}
      colourway={colourway}
      panelTone={colourway === 'white' ? 'light' : 'dark'}
      cameraFov={cameraFov}
      cameraDistance={cameraDistance}
      cameraSafePadding={cameraSafePadding}
      orientation={orientation}
      onOrientationGrabStart={onOrientationGrabStart}
      onOrientationGrabHoverChange={onOrientationGrabHoverChange}
      interactionAudioEnabled={interactionAudioEnabled}
      onPlayPausePress={onPlayPausePress}
      panel={(
        <ProductionPanelView
          colourway={colourway}
          state={state}
          dynamicTypeScale={dynamicTypeScale}
        />
      )}
    />
  )
}

/** Executes the provider-owned transport action before feedback is admitted. */
export async function toggleProductionPlayback(): Promise<boolean> {
  const { provider, source } = musicRuntime.getSnapshot()
  const session = provider.session
  if (
    !provider.supports('transport') ||
    session?.status !== 'authorized' ||
    !session.canPlay ||
    provider.playback.status === 'loading'
  ) return false

  try {
    if (provider.playback.status === 'playing') {
      await provider.pause()
    } else if (provider.playback.now === null) {
      if (source.songs.length === 0) return false
      await provider.play({
        kind: 'tracks',
        tracks: source.songs,
        startIndex: 0,
      })
    } else {
      await provider.play()
    }
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback failed: ${detail}`)
    return false
  }
}
