import type { MusicProvider, PlaybackState, TrackRef } from '@webpod/providers'
import type { ScreenFrame } from '@webpod/state'

import { playbackQueueForFrame } from './navigation'

export interface PlaybackAttempt {
  readonly id: number
  readonly provider: MusicProvider
  readonly frameKey: string
  readonly status: 'pending' | 'resolved' | 'rejected'
}

interface PlaybackPresentationBase {
  readonly playback: PlaybackState
  readonly selectedTrack: TrackRef | null
  readonly attemptApplies: boolean
  readonly settleAttempt: boolean
}

export type PlaybackPresentation =
  | PlaybackPresentationBase & {
      readonly phase: 'empty'
      readonly track: null
    }
  | PlaybackPresentationBase & {
      readonly phase: 'starting'
      readonly track: TrackRef | null
      readonly usesSelectedTrack: boolean
    }
  | PlaybackPresentationBase & {
      readonly phase: 'ready'
      readonly track: TrackRef
    }
  | PlaybackPresentationBase & {
      readonly phase: 'failed'
      readonly track: TrackRef | null
    }

function sameProviderTrack(left: TrackRef, right: TrackRef): boolean {
  return left.key === right.key || (left.provider === right.provider && left.catalogId === right.catalogId)
}

/** Stable identity for one rendered queue occurrence, including duplicates. */
export function playbackFrameKey(frame: ScreenFrame): string {
  const queue = playbackQueueForFrame(frame)
  if (queue === null || queue.startIndex === null) return `${frame.screenId}:none`
  return `${frame.screenId}:${queue.startIndex}:${queue.tracks.map((track) => track.key).join(',')}`
}

/**
 * Reduces command intent and provider observations to one renderable state.
 *
 * Provider observations are authoritative, but queue identity and a coarse
 * `playing` label do not prove that audio has started. A current selection may
 * leave `starting` for successful playback only after its reported playhead has
 * advanced. This keeps the indeterminate progress visible across MusicKit's
 * queue-accepted and pre-audible buffering interval.
 */
export function derivePlaybackPresentation(
  frame: ScreenFrame,
  attempt: PlaybackAttempt | null,
  playback: PlaybackState,
  provider: MusicProvider,
): PlaybackPresentation {
  const queue = playbackQueueForFrame(frame)
  const selectedIndex = queue?.startIndex ?? null
  const selectedTrack = selectedIndex === null ? null : queue?.tracks[selectedIndex] ?? null
  const attemptApplies = attempt?.provider === provider && attempt.frameKey === playbackFrameKey(frame)
  const selectedIdentityOccurrences = selectedTrack === null || queue === null
    ? 0
    : queue.tracks.filter((track) => sameProviderTrack(track, selectedTrack)).length
  const providerOccurrenceMatches = selectedIndex !== null && (
    playback.queueIndex === selectedIndex
    || (selectedIdentityOccurrences === 1 && playback.queueIndex === null)
  )
  const providerIdentityMatches = playback.now !== null && (
    selectedTrack === null
      ? attemptApplies
      : sameProviderTrack(playback.now, selectedTrack) && providerOccurrenceMatches
  )
  const providerPlaybackStarted = providerIdentityMatches
    && playback.status === 'playing'
    && playback.positionMs > 0
  const providerPlaybackCancelled = providerIdentityMatches
    && (playback.status === 'paused' || playback.status === 'stopped')
  const providerReady = attemptApplies
    ? providerPlaybackStarted || providerPlaybackCancelled
    : playback.now !== null && playback.status !== 'error'
  const settleAttempt = attemptApplies && (providerPlaybackStarted || providerPlaybackCancelled)
  const candidateTrack = providerReady && playback.now !== null
    ? playback.now
    : attemptApplies && selectedTrack !== null
      ? selectedTrack
      : playback.now ?? selectedTrack
  const base = { playback, selectedTrack, attemptApplies, settleAttempt }

  if (providerReady && playback.now !== null) {
    return { ...base, phase: 'ready', track: playback.now }
  }
  // A stale rejection cannot beat a matching provider item, but a rejected
  // current attempt must never remain in an endless starting presentation.
  if (playback.status === 'error' || (attemptApplies && attempt?.status === 'rejected')) {
    return { ...base, phase: 'failed', track: candidateTrack }
  }
  if (attemptApplies || playback.status === 'loading') {
    return {
      ...base,
      phase: 'starting',
      track: candidateTrack,
      usesSelectedTrack: candidateTrack !== null && candidateTrack === selectedTrack,
    }
  }
  return { ...base, phase: 'empty', track: null }
}
