import { enumInput, finiteInput, objectInput, tool, type NativeTool } from './native'

/** Production adapter; every operation reads the currently mounted collection owner. */
export interface StickerToolControls {
  open(signal: AbortSignal): Promise<object>
  close(signal: AbortSignal): Promise<object>
  navigate(direction: 'next' | 'previous', signal: AbortSignal): Promise<object>
  list(): object
  grab(stickerId: string, source: 'collection' | 'placed', signal: AbortSignal): Promise<object>
  release(signal: AbortSignal): Promise<object>
  rotate(degrees: number, signal: AbortSignal): Promise<object>
  scale(percent: number, signal: AbortSignal): Promise<object>
  wear(amount: number, signal: AbortSignal): Promise<object>
  place(x: number, y: number, signal: AbortSignal): Promise<object>
}
export type InteractionMutation = (signal: AbortSignal, execute: () => Promise<object>) => Promise<object>
/** One lease across wheel, orientation and sticker writes; reads stay available. */
export function createInteractionMutation(): InteractionMutation {
  let active = false
  return async (signal, execute) => {
    signal.throwIfAborted()
    if (active) throw new Error('Another device interaction is running. Read page state and retry after it completes.')
    active = true
    try { return await execute() } finally { active = false }
  }
}
/** Sticker tools use the current draft's ordinary JSON results and cancellation. */
export function createStickerTools(controls: () => StickerToolControls, mutate: InteractionMutation = createInteractionMutation()): readonly NativeTool[] {
  const empty = (name: string, description: string, action: 'open' | 'close' | 'release') => tool(name, description, {}, async (input, { signal }) => { objectInput(input, []); return mutate(signal, () => controls()[action](signal)) })
  return [
    empty('webpod_open_sticker_pack', 'Reveal the real sticker pack UI on the back face. Requires prepared collection artwork and no human gesture. Does not open or claim sealed earned packs. Returns actual readiness and animation state; read page state until ready.', 'open'),
    empty('webpod_close_sticker_pack', 'Slide the real sticker pack UI away and cancel any held sticker, restoring its saved origin without persistence. Requires the back face and no running placement save.', 'close'),
    tool('webpod_navigate_sticker_collection', 'Move next or previous through owned genre collections using the real UI. Wraps at either end, just like the collection buttons. Cancels any held draft; read page state for artwork preparation. Returns the selected collection and zero-based index.', { direction: { type: 'string', enum: ['next', 'previous'] } }, async (input, { signal }) => {
      const args = objectInput(input, ['direction']); const direction = enumInput(args['direction'], ['next', 'previous'], 'direction')
      return mutate(signal, () => controls().navigate(direction, signal))
    }),
    tool('webpod_sticker_list', 'Read the entire sticker catalogue, including locked and sealed stickers, display metadata, owned/available status, saved placement, scale and normalized wear (0 pristine, 1 maximum). scale equals placement.width as a fraction of back-plate width; unplaced items have null scale. Compare placed items by scale for smallest/largest and by wear for most/least worn. Reports selected collection separately, held draft and real readiness. Ownership is never inferred when inventory is unavailable.', {}, async (input) => { objectInput(input, []); return controls().list() }, true),
    tool('webpod_get_sticker', 'Grab and hold an owned available sticker from collection or placed on the iPod. Requires the back face; collection source requires its current prepared sheet and an opened pack. Returns all catalogue items with saved scale and wear, plus held.scale and held.wear for the current draft. scale is sticker width as a fraction of back-plate width; wear ranges from 0 pristine to 1 maximum. Uses real peel/carry state and shows the adjustment HUD. Use webpod_scale_sticker with percent to resize the held draft. Preserves the exact saved origin. Release discards draft edits; place persists them.', { stickerId: { type: 'string', minLength: 1, maxLength: 128 }, source: { type: 'string', enum: ['collection', 'placed'] } }, async (input, { signal }) => {
      const args = objectInput(input, ['stickerId', 'source']); const id = args['stickerId']; const source = enumInput(args['source'], ['collection', 'placed'], 'source')
      if (typeof id !== 'string' || id.length < 1 || id.length > 128) throw new TypeError('stickerId must be a catalogue identifier.')
      return mutate(signal, () => controls().grab(id, source, signal))
    }),
    empty('webpod_release_sticker', 'Release the held sticker to its exact original saved placement or collection. Discards draft scale, rotation, wear and position. Does not write inventory; cannot undo a placement already accepted by persistence.', 'release'),
    tool('webpod_scale_sticker', 'Resize the held sticker by a relative percentage of its current width, keeping its center, rotation and aspect ratio. Use percent: 45 to increase size by 45% (width 0.25 becomes 0.3625), -45 to shrink by 45%, or 100 to double. Clamps to physical size limits and reports appliedPercent and held.scale. Shows the scale handles in the sticker UI. Changes remain a draft until webpod_place_sticker.', { percent: { type: 'number', minimum: -100, maximum: 10000, description: 'Relative percentage change in width; 45 enlarges by 45%, -45 shrinks by 45%.' } }, async (input, { signal }) => {
      const args = objectInput(input, ['percent']); const percent = finiteInput(args['percent'], 'percent', 10000)
      if (percent < -100) throw new TypeError('percent must be between -100 and 10000.')
      return mutate(signal, () => controls().scale(percent, signal))
    }),
    tool('webpod_rotate_sticker', 'Rotate the held sticker by a relative finite degree delta from -360 to 360. Uses the existing editor constraint helper (stored orientation -180 to 180); reports actual appliedDegrees. Only the held draft changes until placement.', { degrees: { type: 'number', minimum: -360, maximum: 360 } }, async (input, { signal }) => {
      const args = objectInput(input, ['degrees']); const degrees = finiteInput(args['degrees'], 'degrees')
      return mutate(signal, () => controls().rotate(degrees, signal))
    }),
    tool('webpod_add_sticker_wear', 'Add normalized wear to the held sticker draft: amount is 0 to 1, where 0 is pristine and 1 is maximum wear. Clamps using the current editor/domain constraints and reports actual appliedAmount. Persists only on place.', { amount: { type: 'number', minimum: 0, maximum: 1 } }, async (input, { signal }) => {
      const args = objectInput(input, ['amount']); const amount = finiteInput(args['amount'], 'amount', 1)
      if (amount < 0) throw new TypeError('amount must be nonnegative.')
      return mutate(signal, () => controls().wear(amount, signal))
    }),
    tool('webpod_place_sticker', 'Place the held sticker using its actual persistence command. x/y are artwork-center coordinates normalized to the rear plate: x=0 left, x=1 right, y=0 top, y=1 bottom when viewing the back. Center must satisfy the current physical rear silhouette validator; artwork may wrap around edges. Preserves held width, rotation and wear. Awaits save; failures keep a recoverable draft when its source is still valid.', { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, async (input, { signal }) => {
      const args = objectInput(input, ['x', 'y']); const x = finiteInput(args['x'], 'x', 1); const y = finiteInput(args['y'], 'y', 1)
      if (x < 0 || y < 0) throw new TypeError('x and y must be between 0 and 1.')
      return mutate(signal, () => controls().place(x, y, signal))
    }),
  ]
}
