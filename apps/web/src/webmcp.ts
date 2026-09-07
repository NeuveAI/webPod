import { getStickerToolControls, readStickerPageState } from './sticker-webmcp'
import { getAgentWheelControls } from '@webpod/composite'
import { readPageState } from '@webpod/panel'
import { deviceStore } from '@webpod/state'
import { createInteractionMutation, createStickerTools, createInteractionTools, modelContextOf, registerTools } from '@webpod/tools'
import type { DeviceOrientationControls } from './device-preview-orientation'

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
  const registration = registerTools(context, [...createInteractionTools({
    mutation,
    store: deviceStore,
    pageState: () => ({ ...readPageState(), stickers: readStickerPageState() }),
    press: (button, signal) => getAgentWheelControls(deviceStore).press(button, signal),
    rotate: (x, y) => controls().rotate(x, y),
    flick: (face, signal) => controls().flick(face, signal),
  }), ...createStickerTools(getStickerToolControls, mutation)])
  void registration.ready.catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('WebMCP tool registration failed.', error)
  })
  return registration.dispose
}
