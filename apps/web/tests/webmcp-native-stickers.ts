import type { Page } from '@playwright/test'
import { isStickerPlacement, STICKER_GENRES, type StickerInventory, type StickerPlacement } from '../../../packages/stickers/src/index'

export interface NativeStickerMock {
  readonly inventory: () => StickerInventory
  readonly placementWrites: () => number
  readonly packWrites: () => number
  readonly failNextPlacement: () => void
  readonly holdNextPlacement: () => () => void
}

/** Same production network boundary as sticker-collection.e2e.ts. The native
 * registry and app state remain real; only the server inventory is deterministic. */
export async function installNativeStickerInventory(page: Page): Promise<NativeStickerMock> {
  let inventory: StickerInventory = {
    stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'],
    packs: [
      { id: 'native-open', source: 'starter', stickerIds: ['PW-A01', 'PW-B01'], earnedAt: 1, openedAt: 2 },
      { id: 'native-sealed', source: 'listening', stickerIds: ['PW-C01'], earnedAt: 3, openedAt: null },
    ],
    placements: [{ stickerId: 'PW-B01', surface: 'back', x: .42, y: .53, width: .22, rotationDeg: 5, wear: .1 }],
    appearances: [{ stickerId: 'PW-B01', wear: .1 }],
    placementRevision: 0,
    importStatus: 'complete',
    progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  }
  let placementWrites = 0
  let packWrites = 0
  let failNext = false
  let gate: Promise<void> | null = null
  await page.route('**/api/stickers**', async route => {
    const request = route.request()
    if (request.url().endsWith('/packs/open')) packWrites += 1
    if (request.url().endsWith('/placements')) {
      placementWrites += 1
      const pending = gate
      gate = null
      if (pending !== null) await pending
      if (failNext) { failNext = false; await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); return }
      const input: unknown = request.postDataJSON()
      if (typeof input !== 'object' || input === null || !('revision' in input) || !('placements' in input) || !Array.isArray(input.placements) || !input.placements.every(isStickerPlacement)) throw new Error('Invalid placement request from production tool')
      if (input.revision !== inventory.placementRevision) { await route.fulfill({ status: 409, body: '{}' }); return }
      const placements: StickerPlacement[] = input.placements
      inventory = { ...inventory, placements, appearances: placements.map(item => ({ stickerId: item.stickerId, wear: item.wear ?? 0 })), placementRevision: inventory.placementRevision + 1 }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventory) })
  })
  return {
    inventory: () => inventory,
    placementWrites: () => placementWrites,
    packWrites: () => packWrites,
    failNextPlacement: () => { failNext = true },
    holdNextPlacement: () => {
      let release: (() => void) | undefined
      gate = new Promise<void>(resolve => { release = resolve })
      return () => { if (release === undefined) throw new Error('Placement gate missing'); release() }
    },
  }
}
