import { atom } from 'jotai/vanilla'

export type PageActivity = {
  readonly status: 'ready' | 'loading' | 'buffering' | 'error' | 'unavailable'
  readonly operationKey: unknown
  readonly operationStartedAtMs?: number | null
  readonly loadedItems: number
  readonly backgroundLoading: boolean
}
export interface PageState {
  readonly status: PageActivity['status']
  readonly interactionReady: boolean
  readonly startedAtMs: number | null
  readonly elapsedMs: number | null
  readonly progressPercent: number | null
  readonly loadedItems: number
  readonly backgroundLoading: boolean
}
export const pageActivityAtom = atom<PageActivity>({ status: 'unavailable', operationKey: null, loadedItems: 0, backgroundLoading: false })
/** Tracks transitions when they occur; reads never reset the operation clock. */
export function createPageClock(now: () => number = Date.now) {
  let previous: PageActivity | null = null
  let startedAtMs: number | null = null
  let endedAtMs: number | null = null
  return {
    observe(activity: PageActivity): void {
      if (previous === null || previous.operationKey !== activity.operationKey || (isBusy(activity.status) && !isBusy(previous.status))) {
        startedAtMs = previous !== null && previous.operationKey === activity.operationKey
          ? now()
          : activity.operationStartedAtMs ?? (previous === null && !isBusy(activity.status) ? now() : null)
        endedAtMs = null
      }
      if (!isBusy(activity.status) && endedAtMs === null) endedAtMs = now()
      previous = activity
    },
    read(): PageState {
      const activity = previous
      return {
        status: activity?.status ?? 'unavailable',
        interactionReady: activity?.status === 'ready',
        startedAtMs,
        elapsedMs: startedAtMs === null ? null : Math.max(0, (endedAtMs ?? now()) - startedAtMs),
        progressPercent: null,
        loadedItems: activity?.loadedItems ?? 0,
        backgroundLoading: activity?.backgroundLoading ?? false,
      }
    },
  }
}
function isBusy(status: PageActivity['status']): boolean { return status === 'loading' || status === 'buffering' }
