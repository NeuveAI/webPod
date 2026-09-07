import type { InteractionMutation } from './stickers'
import { atom } from 'jotai/vanilla'
import { currentScreenAtom, detentActionAtom, holdEngagedAtom, type DeviceStore, type InteractionPressButton, type ScreenFrame } from '@webpod/state'
import { delay, enumInput, finiteInput, objectInput, tool, type NativeTool } from './native'

export type NavigationProgress = { direction: 'next' | 'previous'; requestedItems: number; completedItems: number; startedAtMs: number; nextStepAtMs: number }
export const navigationProgressAtom = atom<NavigationProgress | null>(null)
export interface InteractionDependencies {
  readonly mutation?: InteractionMutation
  readonly store: DeviceStore
  readonly pageState: () => { readonly interactionReady: boolean; readonly status: string }
  readonly press: (button: InteractionPressButton, signal: AbortSignal) => Promise<boolean>
  readonly rotate: (xDeg: number, yDeg: number) => object
  readonly flick: (face: 'front' | 'back', signal: AbortSignal) => Promise<object>
  readonly setVolume: (level0to100: number, signal: AbortSignal) => Promise<number>
  readonly now?: () => number
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>
}
/** Reads all rows, including the selection, independently of the rendered viewport. */
export function listStatus(store: DeviceStore) {
  const frame = store.get(currentScreenAtom)
  const items = frame?.rows ?? []
  const position = frame?.highlightIndex ?? -1
  const item = items[position]
  return { screenId: frame?.screenId ?? null, title: frame?.title ?? null, isList: frame !== null && frame.route?.kind !== 'now-playing' && frame.route?.kind !== 'status', count: items.length, selectedItem: item === undefined ? null : { position, item }, items }
}
/** Longer requests ramp from deliberate 350ms steps toward a strict 200ms floor. */
export function navigationStepInterval(requestedItems: number, completedItems: number): number {
  return Math.max(200, 350 - Math.min(150, Math.max(0, requestedItems - 2) * 15, completedItems * 30))
}
/** Background sync can rebuild rows, update counts or append a page. Continue
 * only while every original row still targets the same entity at the same index.
 * Unidentified rows retain the conservative reference-identity check. */
function sameTraversalList(initial: ScreenFrame, current: ScreenFrame | null): boolean {
  if (current === null || current.screenId !== initial.screenId || JSON.stringify(current.route) !== JSON.stringify(initial.route)) return false
  if (current.rows === initial.rows) return true
  if (current.rows.length < initial.rows.length) return false
  return initial.rows.every((row, index) => {
    const next = current.rows[index]
    if (next === undefined) return false
    if (row.entityKey !== undefined) return next.entityKey === row.entityKey
    return row.destination !== undefined && JSON.stringify(row.destination) === JSON.stringify(next.destination)
  })
}
/** Builds the production interaction tools. One bounded mutating operation owns the device;
 * cancellation stops further steps, and any replaced list or intervening selection interrupts. */
export function createInteractionTools(deps: InteractionDependencies): readonly NativeTool[] {
  const { store } = deps
  const now = deps.now ?? Date.now
  const wait = deps.wait ?? delay
  let active = false
  let lastStepAt = -Infinity
  const mutate = async (signal: AbortSignal, execute: () => Promise<object>): Promise<object> => {
    signal.throwIfAborted()
    if (active) throw new Error('Another device interaction is running. Read page state and retry after it completes.')
    if (store.get(holdEngagedAtom)) throw new Error('The physical Hold switch is engaged.')
    active = true
    try { return await (deps.mutation === undefined ? execute() : deps.mutation(signal, execute)) } finally { active = false }
  }
  const pageState = () => ({ ...deps.pageState(), navigation: store.get(navigationProgressAtom) })
  const requireReady = () => {
    if (!deps.pageState().interactionReady) throw new Error('This page is not interaction ready. Read webpod_page_state for current progress.')
  }
  const press = async (button: InteractionPressButton, signal: AbortSignal) => {
    const accepted = await deps.press(button, signal)
    signal.throwIfAborted()
    return { accepted, reason: accepted ? null : 'The mounted control did not accept the press; check Hold and page state.', pageState: pageState() }
  }
  return [
    tool('webpod_set_volume', 'Set music playback volume from any screen to an absolute level0to100: 0 mutes, 100 is maximum. Does not change system volume or interaction sound settings. Returns the provider-reported volume0to100. Respects Hold and concurrent device interactions; read webpod_page_state for current volume.', { level0to100: { type: 'number', minimum: 0, maximum: 100 } }, async (input, { signal }) => {
      const args = objectInput(input, ['level0to100'])
      const level = finiteInput(args['level0to100'], 'level0to100', 100)
      if (level < 0) throw new TypeError('level0to100 must be between 0 and 100.')
      return mutate(signal, async () => {
        const volume0to100 = await deps.setVolume(level, signal)
        signal.throwIfAborted()
        return { volume0to100 }
      })
    }),
    tool('webpod_list_status', 'Read the complete current list, count, and selectedItem with its zero-based position as a separate attribute. items includes the selected item; empty and non-list views are explicit.', {}, async (input) => { objectInput(input, []); return listStatus(store) }, true),
    tool('webpod_page_state', 'Read actual page readiness, music volume0to100, loading/buffering state, elapsed milliseconds and progressPercent (null when no real total is known). Read this wall clock to decide when to act; navigation reports direction, requested/completed items and next step time.', {}, async (input) => { objectInput(input, []); return pageState() }, true),
    tool('webpod_navigate_list', 'Traverse a list next (down) or previous (up) by a positive item count, one audible item at a time, clamped at boundaries. Longer moves accelerate, never above five items per second. Requires an interaction-ready list. Returns requested/completed traversal and destination. Traversal stays within the starting list; background metadata updates and appended pages do not interrupt it. Concurrent actions are rejected; cancellation or intervening navigation stops remaining steps.', { direction: { type: 'string', enum: ['next', 'previous'] }, items: { type: 'integer', minimum: 1, maximum: 1000 } }, async (input, { signal }) => {
      const args = objectInput(input, ['direction', 'items'])
      const direction = enumInput(args['direction'], ['next', 'previous'], 'direction')
      const requestedItems = finiteInput(args['items'], 'items', 1000)
      if (!Number.isInteger(requestedItems) || requestedItems < 1) throw new TypeError('items must be a positive integer no larger than 1000.')
      return mutate(signal, async () => {
        requireReady()
        const initial = store.get(currentScreenAtom)
        if (initial === null || !listStatus(store).isList || initial.rows.length === 0) throw new Error('The current view has no traversable list.')
        const rows = initial.rows
        let expectedPosition = initial.highlightIndex
        let completedItems = 0
        const startedAtMs = now()
        let progress: NavigationProgress | null = null
        try {
          for (; completedItems < requestedItems;) {
            signal.throwIfAborted()
            const frame = store.get(currentScreenAtom)
            if (!sameTraversalList(initial, frame) || frame?.highlightIndex !== expectedPosition || !deps.pageState().interactionReady || store.get(holdEngagedAtom)) throw new Error('Navigation interrupted by a changed list, selection, readiness, or Hold switch.')
            const delta = direction === 'next' ? 1 : -1
            if (expectedPosition + delta < 0 || expectedPosition + delta >= rows.length) break
            const interval = navigationStepInterval(requestedItems, completedItems)
            const nextStepAtMs = Math.max(now() + interval, lastStepAt + 200)
            progress = { direction, requestedItems, completedItems, startedAtMs, nextStepAtMs }
            store.set(navigationProgressAtom, progress)
            await wait(nextStepAtMs - now(), signal)
            signal.throwIfAborted()
            const current = store.get(currentScreenAtom)
            if (!sameTraversalList(initial, current) || current?.highlightIndex !== expectedPosition || !deps.pageState().interactionReady || store.get(holdEngagedAtom)) throw new Error('Navigation interrupted before the next step: list targets, selection, readiness, or Hold changed. Read webpod_list_status and webpod_page_state before retrying.')
            store.set(detentActionAtom, { path: 'direct', source: 'agent', detents: delta, timestampMs: now() })
            expectedPosition += delta
            completedItems += 1
            lastStepAt = now()
          }
          return { direction, requestedItems, completedItems, destination: listStatus(store) }
        } finally { if (store.get(navigationProgressAtom) === progress) store.set(navigationProgressAtom, null) }
      })
    }),
    tool('webpod_select_item', 'Press the real center button with physical travel and sound to select the current list item and navigate or start playback. Requires a selected item on an interaction-ready list. The returned pageState may still be loading; read page state until ready.', {}, async (input, { signal }) => {
      objectInput(input, [])
      return mutate(signal, async () => { requireReady(); const list = listStatus(store); if (!list.isList || list.selectedItem === null) throw new Error('There is no list item to select.'); const result = await press('center', signal); if (!result.accepted) throw new Error(result.reason ?? 'Selection was blocked.'); return result })
    }),
    tool('webpod_click_wheel', 'Press one of the five physical click-wheel buttons globally, including on playback views. Uses the same button travel, accepted-action sound and provider semantics as human controls. Menu goes back, center changes playback mode or selects, previous/next use transport or list paging, play-pause toggles playback. Respects Hold and sound settings; browser audio may require prior trusted activation.', { button: { type: 'string', enum: ['menu', 'previous', 'next', 'play-pause', 'center'] } }, async (input, { signal }) => {
      const args = objectInput(input, ['button'])
      const button = enumInput(args['button'], ['menu', 'previous', 'next', 'play-pause', 'center'], 'button')
      return mutate(signal, () => press(button, signal))
    }),
    tool('webpod_rotate_ipod', 'Read webpod_device_state to inspect the current face and orientation first. Rotate the actual iPod by relative degrees: xDeg is pitch and yDeg is yaw, each -360 to 360. Returns the actual clamped production orientation. An active human grab blocks rotation.', { xDeg: { type: 'number', minimum: -360, maximum: 360 }, yDeg: { type: 'number', minimum: -360, maximum: 360 } }, async (input, { signal }) => {
      const args = objectInput(input, ['xDeg', 'yDeg'])
      const x = finiteInput(args['xDeg'], 'xDeg'); const y = finiteInput(args['yDeg'], 'yDeg')
      return mutate(signal, async () => deps.rotate(x, y))
    }),
    tool('webpod_flick_ipod', 'Read webpod_device_state to inspect the current face first. Flick the physical iPod to its front or back plate through its existing spring motion. Resolves with actual orientation after settlement. Human intervention, cancellation or teardown interrupts; reduced motion settles immediately.', { face: { type: 'string', enum: ['front', 'back'] } }, async (input, { signal }) => {
      const args = objectInput(input, ['face']); const face = enumInput(args['face'], ['front', 'back'], 'face')
      return mutate(signal, () => deps.flick(face, signal))
    }),
  ]
}
