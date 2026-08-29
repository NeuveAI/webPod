export const VISIBLE_ROW_SELECTION_DELAY_MS = 80

type TimerHandle = number | ReturnType<typeof setTimeout>

export interface DelayedRowActivation {
  schedule(activate: () => void): boolean
  cancel(): void
  dispose(): void
}

export interface DelayedRowActivationOptions {
  readonly setTimer?: (callback: () => void, delayMs: number) => TimerHandle
  readonly clearTimer?: (handle: TimerHandle) => void
}

/**
 * Holds at most one delayed row activation.
 *
 * The delay lets the shared highlight render before descent. Repeated click
 * events from a double-click are ignored, while keyboard, wheel, and unmount
 * paths can synchronously cancel the pending activation.
 */
export function createDelayedRowActivation(options: DelayedRowActivationOptions = {}): DelayedRowActivation {
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  let pending: TimerHandle | null = null

  const cancel = (): void => {
    if (pending === null) return
    clearTimer(pending)
    pending = null
  }

  return {
    schedule(activate) {
      if (pending !== null) return false
      pending = setTimer(() => {
        pending = null
        activate()
      }, VISIBLE_ROW_SELECTION_DELAY_MS)
      return true
    },
    cancel,
    dispose: cancel,
  }
}
