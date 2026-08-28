import { atom, createStore } from 'jotai/vanilla'

import { getCapabilities, probeCapabilities, type CapabilityReport, type Tier } from './capabilities'

export interface CompositeTierSnapshot {
  readonly tier: Tier
  readonly reason: string
  readonly report: CapabilityReport | null
  readonly contextLost: boolean
}

const unresolved = Symbol('unresolved composite tier')
type TierAtomValue = CompositeTierSnapshot | typeof unresolved

export const compositeTierAtom = atom<TierAtomValue>(unresolved)
export const compositeTierStore = createStore()

function publish(next: CompositeTierSnapshot): void {
  compositeTierStore.set(compositeTierAtom, next)
}

/** The document's single resolved composite tier. Lazily resolved at boot. */
export function getCompositeTierSnapshot(): CompositeTierSnapshot {
  const current = compositeTierStore.get(compositeTierAtom)
  if (current !== unresolved) return current
  const report = getCapabilities()
  const snapshot = {
    tier: report.tier,
    reason: report.tierReason,
    report,
    contextLost: false,
  }
  publish(snapshot)
  return snapshot
}

/** Subscribe to the one tier value; components never run their own probe. */
export function subscribeCompositeTier(listener: () => void): () => void {
  return compositeTierStore.sub(compositeTierAtom, listener)
}

/** Context loss is a T4 fact even if a throwaway probe could create another context. */
export function markCompositeContextLost(): void {
  publish({
    tier: 'T4',
    reason: 'The compositing WebGL context was lost. The device cannot supply pixels until it restores.',
    report: currentReport(),
    contextLost: true,
  })
}

/** Re-probe the real document after the compositing context is restored. */
export function refreshCompositeTier(): CompositeTierSnapshot {
  const report = probeCapabilities()
  const next = {
    tier: report.tier,
    reason: report.tierReason,
    report,
    contextLost: false,
  } as const
  publish(next)
  return next
}

/** Test-only reset kept out of the package's public entry point. */
export function resetCompositeTierForTest(): void {
  compositeTierStore.set(compositeTierAtom, unresolved)
}

function currentReport(): CapabilityReport | null {
  const current = compositeTierStore.get(compositeTierAtom)
  return current === unresolved ? null : current.report
}
