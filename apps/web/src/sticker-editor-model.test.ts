import { afterEach, expect, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom } from '@webpod/state'
import { isStickerPlacement, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { stickerEditorHandleModeAtom, stickerEditorGestureAtom, toggleStickerEditorHandleMode, applyStickerEditor, resetStickerAppearance, constrainedStickerEdit, dismissStickerEditor, previewStickerEdit, resetStickerEditor, revertStickerEditor, selectStickerEditor, setStickerEditorProperty, stickerEditorAtom, stickerEditorDirtyAtom, stickerEditorFailureAtom, stickerEditorPlacementsAtom } from './sticker-editor-model'
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
test('full rear edge permits rotated maximum size without moving center; nonfinite values stay out', () => {
  const edge = { ...source, x: 0, rotationDeg: 137 }
  expect(isStickerPlacement(edge)).toBe(true)
  const result = constrainedStickerEdit(edge, 'width', .35)
  expect(isStickerPlacement(result)).toBe(true); expect(result.width).toBe(.35)
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

test('reset preserves size/center/ownership, clears owned wear and fully straightens at the edge', async () => {
  const edge: StickerPlacement = { ...source, stickerId:'PW-F01',x:0,rotationDeg:90,wear:.9 }
  expect(isStickerPlacement(edge)).toBe(true)
  expect(isStickerPlacement({...edge,rotationDeg:0})).toBe(true)
  const owned={...inventory,stickerIds:['PW-F01'] as const,placements:[edge]}
  deviceStore.set(receiveStickerInventoryActionAtom,owned); selectStickerEditor(edge)
  let calls=0
  await resetStickerAppearance(async(draft,expected)=> {
    calls++; expect(expected).toEqual(edge); expect(isStickerPlacement(draft)).toBe(true)
    expect(draft.x).toBe(edge.x);expect(draft.y).toBe(edge.y);expect(draft.width).toBe(edge.width);expect(draft.wear).toBe(0)
    expect(draft.rotationDeg).toBe(0)
    deviceStore.set(receiveStickerInventoryActionAtom,{...owned,placements:[draft],placementRevision:2})
  })
  expect(calls).toBe(1);expect(deviceStore.get(stickerEditorAtom)?.message).toBeNull()
})


test('rendered placements retain identity across metadata while every editor publication remains observable', () => {
  seed()
  const initial = deviceStore.get(stickerEditorPlacementsAtom)
  let editorPublications = 0, placementPublications = 0
  const stopEditor = deviceStore.sub(stickerEditorAtom, () => { editorPublications++ })
  const stopPlacements = deviceStore.sub(stickerEditorPlacementsAtom, () => { placementPublications++ })
  try {
    setStickerEditorProperty('wear')
    expect(editorPublications).toBe(1); expect(placementPublications).toBe(0)
    expect(deviceStore.get(stickerEditorPlacementsAtom)).toBe(initial)
    previewStickerEdit(.35)
    expect(editorPublications).toBe(2); expect(placementPublications).toBe(1)
    expect(deviceStore.get(stickerEditorPlacementsAtom)[0]?.wear).toBe(.35)
    const latest = deviceStore.get(stickerEditorPlacementsAtom)
    setStickerEditorProperty('rotationDeg')
    expect(editorPublications).toBe(3); expect(placementPublications).toBe(1)
    expect(deviceStore.get(stickerEditorPlacementsAtom)).toBe(latest)
    previewStickerEdit(17)
    expect(deviceStore.get(stickerEditorPlacementsAtom)[0]).toEqual({ ...source, wear: .35, rotationDeg: 17 })
    expect(placementPublications).toBe(2)
  } finally { stopEditor(); stopPlacements() }
})

test('handle mode survives wear edits and cannot change during a gesture or save', () => {
  seed()
  toggleStickerEditorHandleMode()
  expect(deviceStore.get(stickerEditorHandleModeAtom)).toBe('width')
  setStickerEditorProperty('wear'); previewStickerEdit(.4)
  expect(deviceStore.get(stickerEditorHandleModeAtom)).toBe('width')
  deviceStore.set(stickerEditorGestureAtom, true)
  toggleStickerEditorHandleMode()
  expect(deviceStore.get(stickerEditorHandleModeAtom)).toBe('width')
  deviceStore.set(stickerEditorGestureAtom, false)
  deviceStore.set(stickerEditorAtom, state => state === null ? null : { ...state, phase: 'saving' })
  toggleStickerEditorHandleMode()
  expect(deviceStore.get(stickerEditorHandleModeAtom)).toBe('width')
  selectStickerEditor(source)
  expect(deviceStore.get(stickerEditorHandleModeAtom)).toBe('rotationDeg')
})
