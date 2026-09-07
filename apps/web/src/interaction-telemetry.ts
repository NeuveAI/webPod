import { atom, createStore } from 'jotai'

export type TraceEvent = {
  readonly sequence: number
  readonly timestampMs: number
  readonly kind: string
  readonly detail: Readonly<Record<string, unknown>>
}
/** Bounded local recorder. It has no network transport or React subscription. */
export function createInteractionTelemetry(capacity = 1000, now = Date.now) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Trace capacity must be positive')
  const store = createStore()
  const eventsAtom = atom<readonly TraceEvent[]>([])
  const incidentAtom = atom<readonly TraceEvent[] | null>(null)
  let sequence = 0
  let following = 0
  return {
    record(kind: string, detail: Readonly<Record<string, unknown>> = {}) {
      // Copy at the observation boundary: later mutations cannot rewrite evidence.
      const event: TraceEvent = { sequence: ++sequence, timestampMs: now(), kind, detail: structuredClone(detail) }
      store.set(eventsAtom, events => [...events, event].slice(-capacity))
      if (following > 0) {
        store.set(incidentAtom, events => events === null ? null : [...events, event])
        following -= 1
      }
      if (kind === 'state-mismatch' && store.get(incidentAtom) === null) {
        store.set(incidentAtom, store.get(eventsAtom).slice(-80))
        following = 40
      }
    },
    read(limit = capacity) {
      return { version: 1, capturedAtMs: now(), totalEvents: sequence, events: store.get(eventsAtom).slice(-Math.max(1, Math.min(capacity, limit))), firstIncident: store.get(incidentAtom) }
    },
    clear() { store.set(eventsAtom, []); store.set(incidentAtom, null); following = 0 },
  }
}
export const interactionTelemetry = createInteractionTelemetry()
/** Diagnostics must never alter a tool or gesture's outcome. */
export function recordInteraction(kind: string, detail: Readonly<Record<string, unknown>> = {}) {
  try { interactionTelemetry.record(kind, detail) } catch { /* Diagnostic failure is isolated. */ }
}

export function orientationMismatch(
  expected: readonly number[],
  committed: readonly number[] | null,
): boolean {
  return committed === null || expected.some((value, index) => {
    const actual = committed[index]
    return actual === undefined || !Number.isFinite(actual) || Math.abs(value - actual) > .1
  })
}

/** Fires once per sustained incident; recovery rearms it. */
export function createMismatchTracker(thresholdMs = 1500) {
  let since: number | null = null
  let reported = false
  return (mismatch: boolean, now: number): boolean => {
    if (!mismatch) { since = null; reported = false; return false }
    since ??= now
    if (reported || now - since < thresholdMs) return false
    reported = true
    return true
  }
}
