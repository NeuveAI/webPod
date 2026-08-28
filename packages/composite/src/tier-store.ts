import { getCapabilities, probeCapabilities, type CapabilityReport, type Tier } from './capabilities'

export interface CompositeTierSnapshot {
  readonly tier: Tier
  readonly reason: string
  readonly report: CapabilityReport | null
  readonly contextLost: boolean
}

const listeners = new Set<() => void>()
let snapshot: CompositeTierSnapshot | undefined

function publish(next: CompositeTierSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

/** The document's single resolved composite tier. Lazily resolved at boot. */
export function getCompositeTierSnapshot(): CompositeTierSnapshot {
  if (snapshot !== undefined) return snapshot
  const report = getCapabilities()
  snapshot = {
    tier: report.tier,
    reason: report.tierReason,
    report,
    contextLost: false,
  }
  return snapshot
}

/** Subscribe to the one tier value; components never run their own probe. */
export function subscribeCompositeTier(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Context loss is a T4 fact even if a throwaway probe could create another context. */
export function markCompositeContextLost(): void {
  publish({
    tier: 'T4',
    reason: 'The compositing WebGL context was lost. The device cannot supply pixels until it restores.',
    report: snapshot?.report ?? null,
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
  snapshot = undefined
  listeners.clear()
}
