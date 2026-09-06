import { afterEach, expect, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom } from '@webpod/state'
import { isStickerPlacement, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { applyStickerEditor, constrainedStickerEdit, dismissStickerEditor, previewStickerEdit, resetStickerEditor, revertStickerEditor, selectStickerEditor, setStickerEditorProperty, stickerEditorAtom, stickerEditorDirtyAtom, stickerEditorFailureAtom, stickerEditorPlacementsAtom } from './sticker-editor-model'
const source: StickerPlacement = { stickerId: 'PW-C01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0, wear: .2 }
const inventory: StickerInventory = { stickerIds: ['PW-C01'], packs: [], placements: [source], placementRevision: 1, progress: [], importStatus: 'complete' }
function seed() { deviceStore.set(receiveStickerInventoryActionAtom, inventory); selectStickerEditor(source) }
afterEach(() => { resetStickerEditor(); deviceStore.set(resetStickerCollectionActionAtom) })
test('one-copy live draft and gesture cancellation retain inventory identity and values', () => {
  seed(); previewStickerEdit(30)
  expect(deviceStore.get(stickerEditorPlacementsAtom)).toEqual([{ ...source, rotationDeg: 30 }])
  expect(inventory.placements).toEqual([source])
  expect(deviceStore.get(stickerEditorDirtyAtom)).toBe(true)
  revertStickerEditor(); expect(deviceStore.get(stickerEditorPlacementsAtom)).toEqual([source])
  expect(deviceStore.get(stickerEditorDirtyAtom)).toBe(false)
})
test('fixed center constrains rotated size; nonfinite values do not enter draft', () => {
  const edge = { ...source, x: .23 }
  expect(isStickerPlacement(edge)).toBe(true)
  const result = constrainedStickerEdit(edge, 'width', .35)
  expect(isStickerPlacement(result)).toBe(true); expect(result.width).toBeLessThan(.35)
  expect(result.x).toBe(edge.x); expect(result.y).toBe(edge.y)
  expect(constrainedStickerEdit(edge, 'wear', NaN)).toBe(edge)
})
test('gesture save dispatches captured source once and rebases later cancellation to canonical result', async () => {
  seed(); setStickerEditorProperty('wear'); previewStickerEdit(.6)
  let count = 0
  await applyStickerEditor(async (draft, expected) => { count++; expect(expected).toEqual(source); deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placementRevision: 2, placements: [draft] }) })
  expect(count).toBe(1); expect(deviceStore.get(stickerEditorDirtyAtom)).toBe(false)
  previewStickerEdit(.8); revertStickerEditor(); expect(deviceStore.get(stickerEditorAtom)?.draft.wear).toBe(.6)
})
test('failed auto-save restores authority, conflict adopts canonical source, dismissed failure stays local', async () => {
  seed(); previewStickerEdit(20)
  await applyStickerEditor(async () => { throw new Error('offline') })
  expect(deviceStore.get(stickerEditorAtom)?.draft.rotationDeg).toBe(0)
  expect(deviceStore.get(stickerEditorAtom)?.message).toContain('Couldn’t save')
  previewStickerEdit(20)
  await applyStickerEditor(async () => { deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placementRevision: 2, placements: [{ ...source, rotationDeg: 9 }] }); throw { status: 409 } })
  expect(deviceStore.get(stickerEditorAtom)?.draft.rotationDeg).toBe(9)
  previewStickerEdit(22)
  let reject: (cause: Error) => void = () => {}
  const pending = applyStickerEditor(() => new Promise((_resolve, fail) => { reject = fail }))
  dismissStickerEditor(); reject(new Error('offline')); await pending
  expect(deviceStore.get(stickerEditorAtom)).toBeNull(); expect(deviceStore.get(stickerEditorFailureAtom)?.stickerId).toBe(source.stickerId)
})
test('same-ID reselect rebases after pending write and cannot revive a signed-out session', async () => {
  seed(); previewStickerEdit(10)
  let release: () => void = () => {}
  const pending = applyStickerEditor(() => new Promise((resolve) => { release = resolve }))
  selectStickerEditor({ ...source, rotationDeg: 8 }); release(); await pending
  expect(deviceStore.get(stickerEditorAtom)?.draft.rotationDeg).toBe(0)
  previewStickerEdit(17)
  let reject: (e: Error) => void = () => {}
  const rejected = applyStickerEditor(() => new Promise((_resolve, fail) => { reject = fail }))
  resetStickerEditor(); reject(new Error('late')); await rejected
  expect(deviceStore.get(stickerEditorAtom)).toBeNull(); expect(deviceStore.get(stickerEditorFailureAtom)).toBeNull()
})
