import { afterEach, expect, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom } from '@webpod/state'
import type { StickerInventory, StickerPlacement } from '@webpod/stickers'
import { applyStickerEditor, dismissStickerEditor, previewStickerEdit, resetStickerEditor, selectStickerEditor, stickerEditorAtom, stickerEditorFailureAtom, stickerEditorPendingAtom, stickerEditorUndoAtom, undoStickerEdit } from './sticker-editor-model'
const source: StickerPlacement = { stickerId: 'PW-C01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0, wear: .2 }
const inventory: StickerInventory = { stickerIds: ['PW-C01'], packs: [], placements: [source], placementRevision: 1, progress: [], importStatus: 'complete' }
const seed = () => { deviceStore.set(receiveStickerInventoryActionAtom, inventory); selectStickerEditor(source); previewStickerEdit(24) }
afterEach(() => { resetStickerEditor(); deviceStore.set(resetStickerCollectionActionAtom) })
test('same-ID pending lock survives dismiss/reselect; source guard and Undo capture canonical result', async () => {
  seed(); let finish!: () => void, writes = 0
  const pending = applyStickerEditor(async (draft, expected) => { writes++; expect(expected).toEqual(source); await new Promise<void>(resolve => { finish = resolve }); deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placementRevision: 2, placements: [draft] }) })
  dismissStickerEditor(); selectStickerEditor(source); previewStickerEdit(50)
  expect(deviceStore.get(stickerEditorAtom)?.phase).toBe('saving')
  await applyStickerEditor(async () => { writes++ })
  expect(writes).toBe(1); finish(); await pending
  expect(deviceStore.get(stickerEditorAtom)?.draft.rotationDeg).toBe(24)
  expect(deviceStore.get(stickerEditorPendingAtom)).toEqual({})
  expect(deviceStore.get(stickerEditorUndoAtom)?.before).toEqual(source)
})
test('authoritative removal after successful write cannot leave HUD permanently saving', async () => {
  seed(); await applyStickerEditor(async () => { deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placements: [], placementRevision: 2 }) })
  expect(deviceStore.get(stickerEditorAtom)).toBeNull(); expect(deviceStore.get(stickerEditorPendingAtom)).toEqual({})
  expect(deviceStore.get(stickerEditorFailureAtom)?.message).toContain('no longer')
})
test('failed auto-save restores saved pose and retains guarded retry; remote change invalidates Undo', async () => {
  seed(); await applyStickerEditor(async () => { throw new Error('offline') })
  expect(deviceStore.get(stickerEditorAtom)?.draft).toEqual(source)
  expect(deviceStore.get(stickerEditorFailureAtom)?.attempted?.rotationDeg).toBe(24)
  previewStickerEdit(24)
  await applyStickerEditor(async draft => { deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placementRevision: 2, placements: [draft] }) })
  deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory, placementRevision: 3, placements: [{ ...source, rotationDeg: 45 }] })
  let writes = 0; undoStickerEdit(async () => { writes++ })
  expect(writes).toBe(0); expect(deviceStore.get(stickerEditorUndoAtom)).toBeNull()
})
