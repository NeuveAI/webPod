import { resolveDeviceVisibleFace } from '@webpod/device'
import { deviceStore, stickerInventoryAtom } from '@webpod/state'
import { objectInput, tool } from '@webpod/tools'
import type { DeviceOrientationControls } from './device-preview-orientation'
import { readStickerList } from './sticker-webmcp'

/** Read the same live owners as rendering; never rotate or open a pack to inspect. */
export function createDeviceStateTool(controls: () => Pick<DeviceOrientationControls, 'read' | 'isActive' | 'isAnimating'>) {
  return tool('webpod_device_state', 'Read the physical iPod before deciding to rotate or flick it. Reports visibleFace (front/back/edge), current pitch/yaw/roll in degrees, pose, colourway, room, and motion/drag status. Includes saved placed stickers with names, surface, center x/y, width, rotationDeg, explicit scale and wear (0 pristine, 1 maximum); scale equals placement.width, a fraction of back-plate width, for comparing sticker sizes; held draft is separate. Placement coordinates are normalized to the upright back plate: x increases left to right, y top to bottom; width is a fraction of plate width, not screen pixels. Includes stickers.pageState with rendered rearReady and interactionReady. A back orientation alone does not guarantee sticker readiness; if rearReady stays false, report the mismatch instead of repeatedly flicking. Inventory unavailable is explicit. Read-only and available from either face, during motion and while pages load.', {}, async (input) => {
    objectInput(input, [])
    const owner = controls()
    const state = owner.read()
    const inventory = deviceStore.get(stickerInventoryAtom)
    const stickers = readStickerList()
    return {
      ...state,
      visibleFace: resolveDeviceVisibleFace(state.orientation),
      isAnimating: owner.isAnimating(),
      isBeingHeld: owner.isActive(),
      stickers: {
        inventoryLoaded: inventory !== null,
        pageState: stickers.pageState,
        placed: inventory === null ? null : stickers.items.filter(item => item.placement !== null).map(item => ({ id: item.id, name: item.name, placement: item.placement, scale: item.scale, wear: item.wear })),
        held: stickers.held,
        pendingSaves: stickers.pageState.pendingSaves,
      },
    }
  }, true)
}
