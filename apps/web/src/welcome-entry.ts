import { musicRuntimeReady, type MusicRuntimeSnapshot } from './music-runtime'

/** A resolved auth promise is not readiness; the exact accepted runtime must survive the exit. */
export function createWelcomeEntry(current: () => MusicRuntimeSnapshot) {
  let entering = false
  return async (accepted: MusicRuntimeSnapshot, prepare: (isCurrent: () => boolean) => Promise<boolean | undefined>): Promise<boolean> => {
    if (entering || current() !== accepted || !musicRuntimeReady(accepted)) return false
    entering = true
    try {
      return await prepare(() => current() === accepted && musicRuntimeReady(accepted)) ?? false
    } finally { entering = false }
  }
}
