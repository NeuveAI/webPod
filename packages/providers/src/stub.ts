/**
 * The shared body of a capability-only adapter.
 *
 * Apple and Spotify ship as compiling stubs: their capability matrices and
 * their `unsupportedReason()` copy are real and load-bearing from day one, and
 * every other method throws. That is the point of the slice — a parity gap
 * shows up in CI now rather than in production later — and it is why the
 * matrices live in their own modules while the empty bodies live here once.
 *
 * **No code in this file, or in anything that uses it, makes a network call.**
 */

import type { Capability, CapabilityMatrix } from './capability.ts'
import { CapabilityUnsupportedError, NotImplementedError } from './errors.ts'
import type {
  Entity,
  Lyrics,
  Page,
  PlaybackState,
  ProgressTick,
  QueueSnapshot,
  SearchResults,
  Session,
  StationSeed,
  Unsubscribe,
} from './domain.ts'
import type { PlaylistRef, ProviderId, StationRef } from './identity.ts'
import type { MusicProvider } from './provider.ts'

/** What a stub adapter is built from. */
export interface StubProviderSpec {
  readonly id: ProviderId
  readonly displayName: string
  /** The §14.3 column. A `true` here for something the provider lacks is a blocking finding. */
  readonly supports: CapabilityMatrix
  /** Product copy for every capability that is `false`. Rendered verbatim. */
  readonly unsupportedReasons: Readonly<Record<Capability, string | null>>
}

/** Nothing is playing, and nothing can be. */
const IDLE: PlaybackState = {
  status: 'idle',
  now: null,
  positionMs: 0,
  durationMs: 0,
  volume0to100: 0,
  shuffle: 'off',
  repeat: 'off',
}

/**
 * Builds a provider whose matrix works and whose behaviour does not.
 *
 * Every method resolves its capability first. An unsupported one throws
 * {@link CapabilityUnsupportedError}, carrying the same copy a human would be
 * shown; a supported one throws {@link NotImplementedError}. Keeping the two
 * apart matters: "this provider cannot do that" and "we have not written it
 * yet" are different facts with different fixes, and a stub that collapsed them
 * would make the capability matrix look untested when it is the only part that
 * is finished.
 *
 * ⚑ The methods below declare no parameters. That is deliberate and it still
 * satisfies `MusicProvider`: a function of fewer parameters is assignable to
 * one of more. Naming arguments the body cannot use would either need a lint
 * suppression on twenty methods, or a repo-wide rule change made by the lane
 * that does not own the lint config. An absent parameter also reads correctly —
 * this body genuinely does not look at its arguments.
 */
export function createStubProvider(spec: StubProviderSpec): MusicProvider {
  function reasonFor(c: Capability): string {
    const reason = spec.unsupportedReasons[c]
    // Every `false` row must have copy. A stub that reached here with none
    // would render a blank explanation, so it is a defect rather than a state.
    if (reason === null || reason.length === 0) {
      throw new Error(`${spec.id}: capability "${c}" is unsupported and has no reason copy`)
    }
    return reason
  }

  function gate(c: Capability, method: string): never {
    if (!spec.supports[c]) throw new CapabilityUnsupportedError(spec.id, c, reasonFor(c))
    throw new NotImplementedError(spec.id, method)
  }

  return {
    id: spec.id,
    displayName: spec.displayName,

    /** The §14.3 column for this provider. Synchronous, total, real. */
    supports(c: Capability): boolean {
      return spec.supports[c]
    },

    /** Product copy for a missing capability; `null` when it is present. */
    unsupportedReason(c: Capability): string | null {
      return spec.supports[c] ? null : reasonFor(c)
    },

    /** Not implemented — no SDK is loaded and no network call is made. */
    configure(): Promise<void> {
      return gate('auth', 'configure')
    },
    /** Not implemented. */
    authorize(): Promise<Session> {
      return gate('auth', 'authorize')
    },
    /** Not implemented. */
    unauthorize(): Promise<void> {
      return gate('auth', 'unauthorize')
    },
    /** Always `null`: a stub is never signed in. */
    get session(): Session | null {
      return null
    },
    /** Registers the callback and never calls it. Unsubscribing is a no-op. */
    onSessionChange(): Unsubscribe {
      return () => {}
    },

    /** Not implemented. */
    search(): Promise<SearchResults> {
      return gate('search', 'search')
    },
    /** Not implemented. */
    libraryList(): Promise<Page<Entity>> {
      return gate('libraryRead', 'libraryList')
    },
    /** Not implemented. */
    libraryAdd(): Promise<void> {
      return gate('libraryAdd', 'libraryAdd')
    },
    /** Not implemented. ⚑ `libraryRemove` is `false` on Apple. */
    libraryRemove(): Promise<void> {
      return gate('libraryRemove', 'libraryRemove')
    },

    /** Not implemented. */
    playlistCreate(): Promise<PlaylistRef> {
      return gate('playlistCreate', 'playlistCreate')
    },
    /** Not implemented. ⚑ Apple appends to the end, always. */
    playlistAddTracks(): Promise<void> {
      return gate('playlistAddTracks', 'playlistAddTracks')
    },
    /** Not implemented. ⚑ `false` on Apple — §14.3's highest-risk row. */
    playlistRemoveTracks(): Promise<void> {
      return gate('playlistRemoveTracks', 'playlistRemoveTracks')
    },
    /** Not implemented. ⚑ `false` on Apple. */
    playlistReorder(): Promise<void> {
      return gate('playlistReorder', 'playlistReorder')
    },

    /** Not implemented. */
    play(): Promise<void> {
      return gate('transport', 'play')
    },
    /** Not implemented. */
    pause(): Promise<void> {
      return gate('transport', 'pause')
    },
    /** Not implemented. */
    skip(): Promise<void> {
      return gate('transport', 'skip')
    },
    /** Not implemented. */
    seek(): Promise<void> {
      return gate('seek', 'seek')
    },
    /** Not implemented. */
    setVolume(): Promise<void> {
      return gate('volume', 'setVolume')
    },
    /** Idle, always. */
    get playback(): PlaybackState {
      return IDLE
    },
    /** Registers the callback and never calls it. */
    onPlaybackChange(): Unsubscribe {
      return () => {}
    },
    /**
     * Registers the callback and never calls it.
     *
     * Does **not** gate on `progressTicks`. That capability says whether the
     * provider emits a continuous tick, not whether progress is subscribable,
     * and it is the one capability whose `false` hides no control (§14.3 row 25).
     */
    onProgress(): Unsubscribe {
      return () => {}
    },

    /** Not implemented. */
    queueRead(): Promise<QueueSnapshot> {
      return gate('queueRead', 'queueRead')
    },
    /** Not implemented. */
    queueAppend(): Promise<void> {
      return gate('queueAppend', 'queueAppend')
    },
    /** Not implemented. ⚑ `false` on Spotify — no API exists. */
    queueInsertNext(): Promise<void> {
      return gate('queueInsertNext', 'queueInsertNext')
    },
    /** Not implemented. ⚑ `false` on both providers. */
    queueRemove(): Promise<void> {
      return gate('queueRemove', 'queueRemove')
    },
    /** Not implemented. ⚑ `false` on both providers. */
    queueReorder(): Promise<void> {
      return gate('queueReorder', 'queueReorder')
    },

    /** Not implemented. ⚑ `false` on Spotify — S18 is removed there entirely. */
    stationsList(): Promise<StationRef[]> {
      return gate('stations', 'stationsList')
    },
    /** Not implemented. A `track` seed also needs `stationSeedFromTrack`. */
    stationStart(seed: StationSeed): Promise<StationRef> {
      if (seed.type === 'track' && !spec.supports.stationSeedFromTrack) {
        throw new CapabilityUnsupportedError(spec.id, 'stationSeedFromTrack', reasonFor('stationSeedFromTrack'))
      }
      return gate('stations', 'stationStart')
    },

    /** Not implemented. ⚑ `false` on both providers, for different reasons. */
    lyrics(): Promise<Lyrics> {
      return gate('lyrics', 'lyrics')
    },
    /** Not implemented. ⚑ Never route this through `saveToggle` (§14.3 row 23). */
    ratingSet(): Promise<void> {
      return gate('ratingLoveDislike', 'ratingSet')
    },
    /** Not implemented. ⚑ Never aliased to `ratingSet`. */
    saveToggle(): Promise<void> {
      return gate('saveToggle', 'saveToggle')
    },
  }
}

/** Re-exported for the stubs' own progress typing. */
export type { ProgressTick }
