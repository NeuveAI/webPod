import { interactionTelemetry } from './interaction-telemetry'
import { traceNativeTool } from './interaction-telemetry-browser'
import { getStickerToolControls, readStickerPageState } from './sticker-webmcp'
import { getAgentWheelControls, readInteractionAudioState } from '@webpod/composite'
import { readPageState } from '@webpod/panel'
import { deviceStore } from '@webpod/state'
import { createInteractionMutation, createStickerTools, createInteractionTools, modelContextOf, registerTools, objectInput, tool, type NativeTool } from '@webpod/tools'
import type { DeviceOrientationControls } from './device-preview-orientation'
import { createDeviceStateTool } from './device-state-webmcp'
import { musicRuntime } from './music-runtime'

/** Registers native tools against the production store and live orientation owner. */
export function mountWebMcp(document: Document, orientation: () => DeviceOrientationControls | null): () => void {
  const context = modelContextOf(document)
  if (context === null) return () => {}
  const controls = () => {
    const value = orientation()
    if (value === null) throw new Error('The device orientation controls are not mounted.')
    return value
  }
  const mutation = createInteractionMutation()
  const definitions = [...createInteractionTools({
    mutation,
    store: deviceStore,
    pageState: () => ({ ...readPageState(), volume0to100: musicRuntime.getSnapshot().provider.playback.volume0to100, stickers: readStickerPageState(), audio: readInteractionAudioState(deviceStore) }),
    setVolume: async (level, signal) => {
      signal.throwIfAborted()
      const provider = musicRuntime.getSnapshot().provider
      if (!provider.supports('volume')) throw new Error('The active music provider does not support volume control.')
      await provider.setVolume(level)
      return provider.playback.volume0to100
    },
    press: (button, signal) => getAgentWheelControls(deviceStore).press(button, signal),
    rotate: (x, y) => controls().rotate(x, y),
    flick: (face, signal) => controls().flick(face, signal),
  }), createDeviceStateTool(controls), ...createStickerTools(getStickerToolControls, mutation)]
  if (import.meta.env.DEV) definitions.push(tool('webpod_debug_trace', 'Read bounded local interaction telemetry: recent tool calls, gestures, orientation/render readiness snapshots and the first sustained mismatch. No network transmission or state changes.', {}, async input => { objectInput(input, []); return interactionTelemetry.read(80) }, true))
  const presented = definitions.map(definition => presentToolInteraction(definition, document))
  const registration = registerTools(context, import.meta.env.DEV ? presented.map(traceNativeTool) : presented)
  void registration.ready.catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('WebMCP tool registration failed.', error)
  })
  return registration.dispose
}

/** Let React and the physical scene paint a mutation before an agent's next call.
 * Background tabs cannot paint; the bounded fallback keeps tools usable there. */
function presentToolInteraction(definition: NativeTool, document: Document): NativeTool {
  if (definition.annotations.readOnlyHint) return definition
  return { ...definition, execute: async (input, options) => {
    const result = await definition.execute(input, options)
    const view = document.defaultView
    if (view !== null && !document.hidden && !options.signal.aborted) await new Promise<void>(resolve => {
      let frame = 0
      const finish = () => { view.cancelAnimationFrame(frame); view.clearTimeout(timeout); options.signal.removeEventListener('abort', finish); resolve() }
      const timeout = view.setTimeout(finish, 250)
      options.signal.addEventListener('abort', finish, { once: true })
      frame = view.requestAnimationFrame(() => { frame = view.requestAnimationFrame(finish) })
    })
    return result
  } }
}
