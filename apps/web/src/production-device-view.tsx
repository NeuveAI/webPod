import { CompositeDevice } from '@webpod/composite'
import type {
  DeviceOrientation,
  DeviceOrientationGrabStart,
} from '@webpod/device'
import { fixtureProvider, Panel, type PanelState } from '@webpod/panel'
import { useCallback } from 'react'

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
  return (
    <Panel
      colourway={colourway === 'white' ? 'light' : 'dark'}
      state={state}
      dynamicTypeScale={dynamicTypeScale}
      density={null}
      actor="human"
      artworkTone={null}
      longList={false}
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
  const session = fixtureProvider.session
  if (
    !fixtureProvider.supports('transport') ||
    session?.status !== 'authorized' ||
    !session.canPlay ||
    fixtureProvider.playback.status === 'loading'
  ) return false

  try {
    if (fixtureProvider.playback.status === 'playing') {
      await fixtureProvider.pause()
    } else if (fixtureProvider.playback.now === null) {
      if (fixtureProvider.catalog.tracks.length === 0) return false
      await fixtureProvider.play({
        kind: 'tracks',
        tracks: fixtureProvider.catalog.tracks,
        startIndex: 0,
      })
    } else {
      await fixtureProvider.play()
    }
    return true
  } catch {
    return false
  }
}
