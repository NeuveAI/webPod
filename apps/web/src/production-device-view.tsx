import { musicManager, manageMusic } from '@webpod/music-management'
import { stickerPackTuckAtom } from './sticker-pack-tuck'
import { deviceRevealActiveAtom } from './device-reveal-state'
import { stickerPackPresenceAtom } from './sticker-pack-presence'
import { CompositeDevice } from '@webpod/composite'
import type {
  DeviceOrientation,
  DeviceOrientationGrabStart,
} from '@webpod/device'
import { Panel, showNowPlayingScreen, subscribeToRootScreenEntry, type NavigationStatus, type PanelState } from '@webpod/panel'
import { memo, useCallback, useEffect, useSyncExternalStore } from 'react'
import { musicRuntime, quiesceMusicProvider, type MusicRuntimeSnapshot } from './music-runtime'
import { useAtomValue } from 'jotai'
import { deviceStore, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { STICKER_CATALOGUE, isStickerPlacement } from '@webpod/stickers'
import { FRONT_DEVICE_ORIENTATION, type StickerRearProjection } from '@webpod/device'
import { stickerPackTurnAtom, activeStickerCollectionAtom, stickerCollectionsAtom, stickerSheetRevealAtom, stickerDragOffsetAtom, stickerWorkspaceLoweringAtom, stickerPreparedIdsAtom, stickerCollectionUsableAtom, stickerPreparationIdsAtom, requestedStickerCollectionAtom, displayedStickerGenreAtom, stickerProjectionVersionAtom } from './sticker-collections-model'
import { stickerEditorPlacementsAtom } from './sticker-editor-model'
import { StickerCollection } from './sticker-collection'
import { stickerSourceAnchorAtom, stickerSourcePullAtom } from './sticker-carry-anchor'
import { adaptStickerGrab } from './sticker-grab'
import { openStickerPack, placeSticker, removeSticker, retryStickerCollection } from './sticker-runtime'
import { stickerFinishCalibrationAtom, reportStickerArtworkFailure, reportStickerArtworkReady } from './sticker-interaction'
import { createStickerProjectionNotifications } from './sticker-projection-notifications'

let stickerProjection: StickerRearProjection | null = null
const projectionNotifications = createStickerProjectionNotifications(() => deviceStore.set(stickerProjectionVersionAtom, version => version + 1))
const onStickerSurfaceReady = (): void => { projectionNotifications.notify() }
const onStickerProjectionReady = (handle: StickerRearProjection | null): void => { stickerProjection = handle; projectionNotifications.notify() }
import.meta.hot?.dispose(() => projectionNotifications.cancel())
const onStickerPrepared = (ids: readonly string[]): void => {
  for (const id of ids) reportStickerArtworkReady(id)
  deviceStore.set(stickerPreparedIdsAtom, (current) => current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids)
  const requested = deviceStore.get(requestedStickerCollectionAtom)
  if (requested !== null && requested.slots.every((slot) => ids.includes(slot.art.id))) deviceStore.set(displayedStickerGenreAtom, requested.genre)
}
const fitStickerPlacement = (placement: import('@webpod/stickers').StickerPlacement) => {
  const fitted = stickerProjection?.fit?.(placement)
  return isStickerPlacement(fitted) ? fitted : placement
}
const stickerCommands = { resolveDrop: (placement: import('@webpod/stickers').StickerPlacement, x: number, y: number) => { const result = stickerProjection?.resolveDrop?.(placement, x, y); return isStickerPlacement(result) ? result : placement }, fit: fitStickerPlacement, retry: retryStickerCollection, openPack: openStickerPack, place: (placement: import('@webpod/stickers').StickerPlacement, expectedSource?: import('@webpod/stickers').StickerPlacement) => placeSticker(fitStickerPlacement(placement), expectedSource), remove: removeSticker, project: (clientX: number, clientY: number) => stickerProjection?.project(clientX, clientY) ?? null, grab: (x: number, y: number) => adaptStickerGrab(stickerProjection?.grab?.(x, y)), hit: (x: number, y: number) => { const hit = stickerProjection?.hit(x, y); return isStickerPlacement(hit) ? hit : null }, contour: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.contour?.(placement) ?? null, quad: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.quad?.(placement) ?? null, beginTransform: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.beginTransform?.(placement) ?? null, bounds: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.bounds?.(placement) ?? null, screen: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.screen(placement) ?? null }

export type ProductionPanelState = PanelState

interface PlaybackRuntimeContext {
  getSnapshot(): Pick<MusicRuntimeSnapshot, 'provider'>
  subscribe(listener: () => void): () => void
}

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
export const ProductionPanelView = memo(function ProductionPanelView({
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
})

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
  const packTuck = useAtomValue(stickerPackTuckAtom, { store: deviceStore })
  const packPresence = useAtomValue(stickerPackPresenceAtom, { store: deviceStore })
  const deviceRevealing = useAtomValue(deviceRevealActiveAtom, { store: deviceStore })
  const preparationIds = useAtomValue(stickerPreparationIdsAtom, { store: deviceStore })
  const collectionUsable = useAtomValue(stickerCollectionUsableAtom, { store: deviceStore })
  const stickerInteraction = useAtomValue(stickerInteractionAtom, { store: deviceStore })
  const collection = useAtomValue(activeStickerCollectionAtom, { store: deviceStore })
  const collections = useAtomValue(stickerCollectionsAtom, { store: deviceStore })
  const sheetReveal = useAtomValue(stickerSheetRevealAtom, { store: deviceStore })
  const sourcePull = useAtomValue(stickerSourcePullAtom, { store: deviceStore })
  const sourceAnchor = useAtomValue(stickerSourceAnchorAtom, { store: deviceStore })
  const dragOffset = useAtomValue(stickerDragOffsetAtom, { store: deviceStore })
  const packTurn = useAtomValue(stickerPackTurnAtom, { store: deviceStore })
  const workspaceLowering = useAtomValue(stickerWorkspaceLoweringAtom, { store: deviceStore })
  const stickerPlacements = useAtomValue(stickerEditorPlacementsAtom, { store: deviceStore })
  const inventory = useAtomValue(stickerInventoryAtom, { store: deviceStore })
  const calibratedFinish = useAtomValue(stickerFinishCalibrationAtom, { store: deviceStore })
  // The account runtime owns collection lifetime; scene cleanup also runs during
  // StrictMode mounts and must never cancel an authenticated reconnect.
  useEffect(() => () => { projectionNotifications.cancel() }, [])
  useEffect(() => subscribeToRootScreenEntry(() => {
    void pauseProductionPlaybackAtRoot()
  }), [])
  const onPlayPausePress = useCallback(
    () => toggleProductionPlayback(),
    [],
  )
  const onTransportPress = useCallback(
    (button: 'play-pause' | 'next' | 'previous') => button === 'play-pause'
      ? toggleProductionPlayback()
      : skipProductionPlayback(button),
    [],
  )
  const preparedSheet = collection === null ? undefined : { neighbors: collections.filter((item) => item.genre !== collection.genre).slice(0, 2).flatMap((item) => item.slots[0] === undefined ? [] : [{ ink: item.ink, stickerId: item.slots[0].art.id }]), reveal: sheetReveal, ink: collection.ink, slots: collection.slots.map((slot) => ({ stickerId: slot.art.id, state: slot.state })) }
  return (
    <>
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
      onTransportPress={onTransportPress}
      stickerScene={{ assets: STICKER_CATALOGUE, preparedSheet: collectionUsable ? preparedSheet : undefined, prepareIds: preparationIds, onPrepared: onStickerPrepared, placements: stickerPlacements, appearances: inventory?.appearances, pack: deviceRevealing || (!collectionUsable && stickerInteraction.sourcePlacement == null) || stickerInteraction.stage === 'hidden' ? null : { presence: packPresence, workspaceVisible: collectionUsable, tuck: packTuck, progress: stickerInteraction.progress, peel: stickerInteraction.peel, sourcePeelFront: stickerInteraction.sourcePeelFront, detachTransport: stickerInteraction.detachTransport, stickerId: stickerInteraction.selectedStickerId, placement: stickerInteraction.previewPlacement, landing: stickerInteraction.landing, sourcePlacement: stickerInteraction.sourcePlacement, returnToSheet: stickerInteraction.returnToSheet, sourceAnchor: sourceAnchor ?? undefined, sourcePull: sourcePull ?? undefined, dragOffset, workspaceLowering, turn: packTurn, sheet: preparedSheet }, finishEnabled: import.meta.env.DEV ? calibratedFinish : true, onSurfaceReady: onStickerSurfaceReady, onProjectionReady: onStickerProjectionReady, onArtworkError: reportStickerArtworkFailure, onArtworkReady: reportStickerArtworkReady }}
      panel={(
        <ProductionPanelView
          colourway={colourway}
          state={state}
          dynamicTypeScale={dynamicTypeScale}
        />
      )}
    />
    <StickerCollection orientation={orientation ?? FRONT_DEVICE_ORIENTATION} commands={stickerCommands} />
    </>
  )
}

/** Pauses the provider whose playback would otherwise become invisible at the root. */
export async function pauseProductionPlaybackAtRoot(snapshot: MusicRuntimeSnapshot = musicRuntime.getSnapshot()): Promise<boolean> {
  const provider = manageMusic(snapshot.provider)
  try {
    await quiesceMusicProvider(provider)
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback could not pause at the root: ${detail}`)
    return false
  }
}

/** Executes the provider-owned transport action before feedback is admitted. */
export async function toggleProductionPlayback(snapshot: MusicRuntimeSnapshot = musicRuntime.getSnapshot()): Promise<boolean> {
  const { provider, source } = snapshot
  const session = provider.session
  if (
    !provider.supports('transport') ||
    session?.status !== 'authorized' ||
    !session.canPlay
  ) return false

  // Admitted transport input returns the listener to the playback surface at
  // once; MusicKit latency must not make the wheel appear unresponsive.
  showNowPlayingScreen()
  try {
    await musicManager(provider).toggle(source.songs)
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback failed: ${detail}`)
    return false
  }
}

/** Delegates skip order to the provider's live queue, never to the visible list. */
export async function skipProductionPlayback(
  direction: 'next' | 'previous',
  snapshot: MusicRuntimeSnapshot = musicRuntime.getSnapshot(),
  runtimeContext: PlaybackRuntimeContext = musicRuntime,
): Promise<boolean> {
  const { provider } = snapshot
  const session = provider.session
  const playback = provider.playback
  if (
    !provider.supports('transport')
    || session?.status !== 'authorized'
    || !session.canPlay
    || (playback.now === null && playback.status !== 'loading')
  ) return false

  showNowPlayingScreen()
  const manager = musicManager(provider)
  const stop = runtimeContext.subscribe(() => { if (runtimeContext.getSnapshot().provider !== provider) manager.deactivate() })
  try {
    await manager.provider.skip(direction)
    if (runtimeContext.getSnapshot().provider !== provider) throw new Error('Playback transport context was superseded')
    showNowPlayingScreen({ followPlayback: true })
    return true
  } finally { stop() }
}
