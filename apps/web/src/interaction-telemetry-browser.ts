import { deviceFrontVisibility } from '@webpod/device'
import { readPageState } from '@webpod/panel'
import { readInteractionAudioState } from '@webpod/composite'
import { deviceStore } from '@webpod/state'
import type { NativeTool } from '@webpod/tools'
import { applePlaybackDiagnostics } from './apple-playback-diagnostics'
import type { DeviceOrientationControls } from './device-preview-orientation'
import { readStickerPageState } from './sticker-webmcp'
import { createMismatchTracker, interactionTelemetry, orientationMismatch, recordInteraction } from './interaction-telemetry'

/** Observe independent owners without subscribing the device React tree to telemetry. */
export function mountInteractionTelemetry(document: Document, controls: () => DeviceOrientationControls | null) {
  let previous = ''
  const detectMismatch = createMismatchTracker()
  let sceneWasReady = false
  let lastRecord = 0
  const sample = () => {
    try {
      const owner = controls()
      if (owner === null) return
      const state = owner.read()
      const expected = [state.orientation.pitchDeg, state.orientation.yawDeg, state.orientation.rollDeg]
      const root = document.querySelector<HTMLElement>('.webpod-device-preview')
      const canvas = root?.querySelector('canvas')
      const tier = root?.querySelector<HTMLElement>('[data-composite-tier]')?.dataset['compositeTier'] ?? null
      const stage = root?.querySelector<HTMLElement>('.webpod-device-preview__stage')
      const parse = (value: string | undefined) => value === undefined ? null : value.split(',').map(Number)
      const reactOrientation = parse(root?.dataset['orientation'])
      const sceneOrientation = parse(canvas?.dataset['wpSceneOrientation'])
      const stickers = readStickerPageState()
      const page = readPageState()
      const audio = readInteractionAudioState(deviceStore)
      const latestPlayback = applePlaybackDiagnostics.getSnapshot().events.at(-1)
      const snapshot = {
        orientation: expected, reactOrientation, sceneOrientation,
        held: owner.isActive(), animating: owner.isAnimating(), tier,
        grab: stage?.dataset['orientationGrab'] ?? null,
        motion: stage?.dataset['orientationMotion'] ?? null,
        rearReady: stickers.rearReady, stickerStatus: stickers.status, stickerStage: stickers.stage,
        humanBusy: stickers.humanBusy, pendingSaves: stickers.pendingSaves,
        screen: root?.querySelector<HTMLElement>('[data-screen]')?.dataset['screen'] ?? null,
        pageStatus: page.status, audio: audio.snapshot?.lifecycle ?? null,
        hidden: document.hidden, focused: document.hasFocus(),
        source: canvas?.dataset['wpCompositeSourceState'] ?? null,
      }
      if (sceneOrientation !== null) sceneWasReady = true
      const mismatch = sceneWasReady && tier === 'T1' && !snapshot.held && !snapshot.animating && !document.hidden &&
        (orientationMismatch(expected, reactOrientation) || orientationMismatch(expected, sceneOrientation) ||
          (deviceFrontVisibility(state.orientation) < -.7 && !stickers.rearReady))
      const now = Date.now()
      if (detectMismatch(mismatch, now)) recordInteraction('state-mismatch', snapshot)
      const key = JSON.stringify(snapshot)
      if (key !== previous || now - lastRecord >= 5000) {
        recordInteraction('snapshot', { ...snapshot, playbackEvent: latestPlayback?.event ?? null, playbackSequence: latestPlayback?.sequence ?? null })
        previous = key
        lastRecord = now
      }
    } catch { /* A missing/tearing-down renderer must not affect playback. */ }
  }
  const pointer = (event: Event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.webpod-device-preview__stage')) return
    const value = event as PointerEvent
    recordInteraction(event.type, { pointerId: value.pointerId, pointerType: value.pointerType, buttons: value.buttons, target: event.target.tagName })
  }
  const lifecycle = (event: Event) => { recordInteraction(event.type); sample() }
  const pointerEvents = ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']
  for (const name of pointerEvents) document.addEventListener(name, pointer, true)
  document.addEventListener('visibilitychange', lifecycle)
  document.defaultView?.addEventListener('blur', lifecycle)
  document.defaultView?.addEventListener('focus', lifecycle)
  let playbackSequence: number | null = null
  const unsubscribePlayback = applePlaybackDiagnostics.subscribe(() => {
    const event = applePlaybackDiagnostics.getSnapshot().events.at(-1)
    if (event === undefined || event.sequence === playbackSequence) return
    playbackSequence = event.sequence
    if (['playbackTimeDidChange', 'bufferedProgressDidChange'].includes(event.event)) return
    recordInteraction('playback-event', { event: event.event, sequence: event.sequence, playbackState: event.musicKit.playbackState, errorClass: event.errorClass ?? null })
  })
  const timer = setInterval(sample, 250)
  const beforeUpdate = () => recordInteraction('source-update-start')
  const afterUpdate = () => { recordInteraction('source-update-end'); sample() }
  import.meta.hot?.on('vite:beforeUpdate', beforeUpdate)
  import.meta.hot?.on('vite:afterUpdate', afterUpdate)
  recordInteraction('telemetry-mounted')
  sample()
  return () => {
    clearInterval(timer)
    import.meta.hot?.off('vite:beforeUpdate', beforeUpdate)
    import.meta.hot?.off('vite:afterUpdate', afterUpdate)
    unsubscribePlayback()
    for (const name of pointerEvents) document.removeEventListener(name, pointer, true)
    document.removeEventListener('visibilitychange', lifecycle)
    document.defaultView?.removeEventListener('blur', lifecycle)
    document.defaultView?.removeEventListener('focus', lifecycle)
    recordInteraction('telemetry-unmounted')
  }
}

let nextCallId = 0
export function traceNativeTool(definition: NativeTool): NativeTool {
  return { ...definition, execute: async (input, options) => {
    const callId = ++nextCallId
    recordInteraction('tool-start', { callId, name: definition.name })
    try {
      const result = await definition.execute(input, options)
      recordInteraction('tool-end', { callId, name: definition.name })
      return result
    } catch (error) {
      recordInteraction('tool-error', { callId, name: definition.name, error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error', aborted: options.signal.aborted })
      throw error
    }
  } }
}

export function copyInteractionTrace() {
  return navigator.clipboard.writeText(JSON.stringify(interactionTelemetry.read(), null, 2))
}
