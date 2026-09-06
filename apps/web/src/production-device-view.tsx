import { CompositeDevice } from '@webpod/composite'
import type {
  DeviceOrientation,
  DeviceOrientationGrabStart,
} from '@webpod/device'
import { Panel, showNowPlayingScreen, subscribeToRootScreenEntry, type NavigationStatus, type PanelState } from '@webpod/panel'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { musicRuntime, quiesceMusicProvider, type MusicRuntimeSnapshot } from './music-runtime'
import { useAtomValue } from 'jotai'
import { deviceStore, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { STICKER_CATALOGUE, isStickerPlacement } from '@webpod/stickers'
import { FRONT_DEVICE_ORIENTATION, type StickerRearProjection } from '@webpod/device'
import { activeStickerCollectionAtom, stickerCollectionsAtom, stickerSheetRevealAtom, stickerDragOffsetAtom, stickerWorkspaceLoweringAtom, stickerPreparedIdsAtom, stickerCollectionUsableAtom, stickerPreparationIdsAtom, requestedStickerCollectionAtom, displayedStickerGenreAtom, stickerProjectionVersionAtom } from './sticker-collections-model'
import { stickerEditorAtom, stickerEditorPlacementsAtom } from './sticker-editor-model'
import { StickerCollection } from './sticker-collection'
import { openStickerPack, placeSticker, removeSticker, retryStickerCollection, stopStickerRuntime } from './sticker-runtime'
import { stickerFinishCalibrationAtom, reportStickerArtworkFailure, reportStickerArtworkReady } from './sticker-interaction'

let stickerProjection: StickerRearProjection | null = null
const onStickerProjectionReady = (handle: StickerRearProjection | null): void => { stickerProjection = handle; deviceStore.set(stickerProjectionVersionAtom, (version) => version + 1) }
const onStickerPrepared = (ids: readonly string[]): void => {
  for (const id of ids) reportStickerArtworkReady(id)
  deviceStore.set(stickerPreparedIdsAtom, (current) => current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids)
  const requested = deviceStore.get(requestedStickerCollectionAtom)
  if (requested !== null && requested.slots.every((slot) => ids.includes(slot.art.id))) deviceStore.set(displayedStickerGenreAtom, requested.genre)
}
const stickerCommands = { retry: retryStickerCollection, openPack: openStickerPack, place: placeSticker, remove: removeSticker, project: (clientX: number, clientY: number) => stickerProjection?.project(clientX, clientY) ?? null, hit: (x: number, y: number) => { const hit = stickerProjection?.hit(x, y); return isStickerPlacement(hit) ? hit : null }, quad: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.quad?.(placement) ?? null, beginTransform: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.beginTransform?.(placement) ?? null, bounds: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.bounds?.(placement) ?? null, screen: (placement: import('@webpod/stickers').StickerPlacement) => stickerProjection?.screen(placement) ?? null }

export type ProductionPanelState = PanelState

interface PlaybackRuntimeContext {
  getSnapshot(): Pick<MusicRuntimeSnapshot, 'provider'>
  subscribe(listener: () => void): () => void
}

const providerTransportWrites = new WeakMap<MusicRuntimeSnapshot['provider'], Promise<void>>()
interface RequestedPlaybackState {
  readonly playing: boolean
  readonly generation: number
}
const requestedPlayingState = new WeakMap<MusicRuntimeSnapshot['provider'], RequestedPlaybackState>()
let requestedPlaybackGeneration = 0

function enqueueProviderTransport(provider: MusicRuntimeSnapshot['provider'], work: () => Promise<void>): Promise<void> {
  const prior = providerTransportWrites.get(provider) ?? Promise.resolve()
  const next = prior.catch(() => undefined).then(work)
  providerTransportWrites.set(provider, next)
  void next.finally(() => {
    if (providerTransportWrites.get(provider) === next) providerTransportWrites.delete(provider)
  }).catch(() => undefined)
  return next
}

function waitForPlaybackContext(
  provider: MusicRuntimeSnapshot['provider'],
  runtimeContext: PlaybackRuntimeContext,
): Promise<boolean> {
  if (runtimeContext.getSnapshot().provider !== provider) return Promise.resolve(false)
  if (provider.playback.status !== 'loading') return Promise.resolve(provider.playback.now !== null && provider.playback.status !== 'error')
  return new Promise((resolve) => {
    let settled = false
    let unsubscribePlayback = (): void => {}
    let unsubscribeRuntime = (): void => {}
    const finish = (ready: boolean) => {
      if (settled) return
      settled = true
      unsubscribePlayback()
      unsubscribeRuntime()
      resolve(ready)
    }
    const inspect = () => {
      if (runtimeContext.getSnapshot().provider !== provider) finish(false)
      else if (provider.playback.status !== 'loading') finish(provider.playback.now !== null && provider.playback.status !== 'error')
    }
    unsubscribePlayback = provider.onPlaybackChange(inspect)
    unsubscribeRuntime = runtimeContext.subscribe(inspect)
    inspect()
  })
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
  const preparationIds = useAtomValue(stickerPreparationIdsAtom, { store: deviceStore })
  const collectionUsable = useAtomValue(stickerCollectionUsableAtom, { store: deviceStore })
  const stickerInteraction = useAtomValue(stickerInteractionAtom, { store: deviceStore })
  const collection = useAtomValue(activeStickerCollectionAtom, { store: deviceStore })
  const collections = useAtomValue(stickerCollectionsAtom, { store: deviceStore })
  const sheetReveal = useAtomValue(stickerSheetRevealAtom, { store: deviceStore })
  const dragOffset = useAtomValue(stickerDragOffsetAtom, { store: deviceStore })
  const workspaceLowering = useAtomValue(stickerWorkspaceLoweringAtom, { store: deviceStore })
  const stickerPlacements = useAtomValue(stickerEditorPlacementsAtom, { store: deviceStore })
  const editor = useAtomValue(stickerEditorAtom, { store: deviceStore })
  const inventory = useAtomValue(stickerInventoryAtom, { store: deviceStore })
  const calibratedFinish = useAtomValue(stickerFinishCalibrationAtom, { store: deviceStore })
  useEffect(() => () => stopStickerRuntime(false), [])
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
      stickerScene={{ assets: STICKER_CATALOGUE, prepareIds: preparationIds, onPrepared: onStickerPrepared, placements: stickerPlacements, appearances: inventory?.appearances, pack: (!collectionUsable && stickerInteraction.sourcePlacement == null) || stickerInteraction.stage === 'hidden' ? null : { workspaceVisible: collectionUsable && editor === null, progress: stickerInteraction.progress, peel: stickerInteraction.peel, stickerId: stickerInteraction.selectedStickerId, placement: stickerInteraction.previewPlacement, landing: stickerInteraction.landing, sourcePlacement: stickerInteraction.sourcePlacement, returnToSheet: stickerInteraction.returnToSheet, dragOffset, workspaceLowering, sheet: collection === null ? undefined : { neighbors: collections.filter((item) => item.genre !== collection.genre).slice(0, 2).flatMap((item) => item.slots[0] === undefined ? [] : [{ ink: item.ink, stickerId: item.slots[0].art.id }]), reveal: sheetReveal, ink: collection.ink, slots: collection.slots.map((slot) => ({ stickerId: slot.art.id, state: slot.state })) } }, finishEnabled: import.meta.env.DEV ? calibratedFinish : true, onProjectionReady: onStickerProjectionReady, onArtworkError: reportStickerArtworkFailure, onArtworkReady: reportStickerArtworkReady }}
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
  const provider = snapshot.provider
  const generation = ++requestedPlaybackGeneration
  requestedPlayingState.set(provider, { playing: false, generation })
  try {
    await enqueueProviderTransport(provider, () => quiesceMusicProvider(provider))
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback could not pause at the root: ${detail}`)
    return false
  } finally {
    if (requestedPlayingState.get(provider)?.generation === generation) requestedPlayingState.delete(provider)
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

  const currentlyRequestedPlaying = requestedPlayingState.get(provider)?.playing
    ?? (provider.playback.status === 'playing' || provider.playback.status === 'loading')
  const shouldPlay = !currentlyRequestedPlaying
  if (shouldPlay && provider.playback.now === null && source.songs.length === 0) return false
  const generation = ++requestedPlaybackGeneration
  requestedPlayingState.set(provider, { playing: shouldPlay, generation })
  // Admitted transport input returns the listener to the playback surface at
  // once; MusicKit latency must not make the wheel appear unresponsive.
  showNowPlayingScreen()
  try {
    await enqueueProviderTransport(provider, async () => {
      if (!shouldPlay) {
        await provider.pause()
      } else if (provider.playback.now === null) {
        await provider.play({ kind: 'tracks', tracks: source.songs, startIndex: 0 })
      } else {
        await provider.play()
      }
    })
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback failed: ${detail}`)
    return false
  } finally {
    if (requestedPlayingState.get(provider)?.generation === generation) requestedPlayingState.delete(provider)
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

  if (playback.status === 'loading') {
    showNowPlayingScreen()
    try {
      await enqueueProviderTransport(provider, async () => {
        if (!await waitForPlaybackContext(provider, runtimeContext)) throw new Error('Playback transport context was superseded')
        await provider.skip(direction)
      })
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
      console.error(`Music playback could not skip ${direction}: ${detail}`)
      throw cause
    }
    return true
  }

  try {
    await enqueueProviderTransport(provider, () => provider.skip(direction))
    if (runtimeContext.getSnapshot().provider !== provider) throw new Error('Playback transport context was superseded')
    showNowPlayingScreen()
    return true
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown playback failure'
    console.error(`Music playback could not skip ${direction}: ${detail}`)
    throw cause
  }
}
