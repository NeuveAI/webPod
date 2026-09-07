import { expect, test } from 'bun:test'
import { act } from 'react'
import { createRequire } from 'node:module'
import { deviceStore, stickerInteractionAtom } from '@webpod/state'
import { stickerProjectionVersionAtom } from './sticker-collections-model'
import { updateStickerInteraction } from './sticker-interaction'
import { StickerEditor } from './sticker-editor'
import { resetStickerEditor, selectStickerEditor, setStickerEditorProperty, previewStickerEdit, stickerEditorAtom, dismissStickerEditor } from './sticker-editor-model'

test('moving suppresses all appearance controls, while idle selection retains rotation and wear', async () => {
  const require = createRequire(new URL('../../../packages/composite/package.json', import.meta.url))
  const { GlobalRegistrator } = require('@happy-dom/global-registrator') as { GlobalRegistrator: { register(): void; unregister(): void } }
  GlobalRegistrator.register()
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const originalMatch = globalThis.matchMedia
  let reducedMotion = true
  globalThis.matchMedia = query => ({ matches: reducedMotion, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true })
  const oldRequest = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {}
  const initial = deviceStore.get(stickerInteractionAtom)
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  const source = { stickerId: 'PW-C03' as const, surface: 'back' as const, x: .5, y: .5, width: .25, rotationDeg: 0, wear: .2 }
  const points = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 300 }, { x: 100, y: 300 }] as const
  let contourCalls = 0
  try {
    await act(async () => { updateStickerInteraction({ ...initial, stage: 'hidden' }); selectStickerEditor(source); root.render(<StickerEditor screen={() => ({ x: 150, y: 200 })} contour={() => { contourCalls++; return { paths: [points], anchors: points, center: { x: 150, y: 200 } } }} place={async () => {}} returnToPack={() => {}} />) })
    expect(host.querySelector('[data-sticker-contour]')).not.toBeNull()
    expect(host.querySelectorAll('[data-hud-handle="rotate"]')).toHaveLength(4)
    expect(host.querySelector('[aria-label="Sticker wear"]')).not.toBeNull()
    const beforeMetadata = contourCalls
    await act(async () => setStickerEditorProperty('wear'))
    const metadataCalls = contourCalls - beforeMetadata
    const beforePreview = contourCalls
    await act(async () => previewStickerEdit(.35))
    expect(deviceStore.get(stickerEditorAtom)?.draft.wear).toBe(.35)
    expect(metadataCalls).toBe(0)
    expect(contourCalls - beforePreview).toBe(1)
    expect(host.querySelector<HTMLInputElement>('[aria-label="Sticker wear"]')?.value).toBe('0.35')
    const beforeReady = contourCalls
    await act(async () => deviceStore.set(stickerProjectionVersionAtom, version => version + 1))
    expect(contourCalls - beforeReady).toBe(1)
    reducedMotion = false
    await act(async () => dismissStickerEditor())
    expect(host.querySelector('[data-sticker-contour]')).not.toBeNull()
    expect(host.querySelector<HTMLInputElement>('[aria-label="Sticker wear"]')?.value).toBe('0.35')
    const beforeSwitch = contourCalls
    await act(async () => selectStickerEditor({ ...source, stickerId: 'PW-C02', wear: .6 }))
    expect(contourCalls - beforeSwitch).toBe(1)
    expect(host.querySelector('[data-sticker-editor]')?.getAttribute('data-sticker-editor')).toBe('PW-C02')
    expect(host.querySelector<HTMLInputElement>('[aria-label="Sticker wear"]')?.value).toBe('0.6')
    reducedMotion = true
    for (const stage of ['peeling', 'placing', 'settling'] as const) {
      await act(async () => { selectStickerEditor(source); updateStickerInteraction({ ...initial, stage }) })
      expect(host.querySelector('[data-sticker-editor]')).toBeNull()
      expect(host.querySelector('svg, button, input')).toBeNull()
    }
    await act(async () => { updateStickerInteraction({ ...initial, stage: 'hidden' }); selectStickerEditor(source) })
    expect(host.querySelector('[data-sticker-contour]')).not.toBeNull()
    expect(host.querySelector('[aria-label="Sticker wear"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount()); host.remove(); resetStickerEditor(); updateStickerInteraction(initial)
    globalThis.requestAnimationFrame = oldRequest; globalThis.cancelAnimationFrame = oldCancel
    globalThis.matchMedia = originalMatch
    if (previousAct === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT'); else Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct)
    GlobalRegistrator.unregister()
  }
})
