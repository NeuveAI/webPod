import type { MusicProvider, PlaybackState } from '@webpod/providers'
import type { ScreenFrame } from '@webpod/state'
import { musicManager, deriveSelectionPresentation, type PlaybackAttempt, type PlaybackPresentation } from '@webpod/music-management/playback'
import { playbackQueueForFrame } from './navigation'
export type { PlaybackAttempt, PlaybackPresentation } from '@webpod/music-management/playback'

/** Stable identity for one rendered queue occurrence, including duplicates. */
export function playbackFrameKey(frame: ScreenFrame): string {
  const queue = playbackQueueForFrame(frame)
  if (queue === null || queue.startIndex === null) return `${frame.screenId}:none`
  return `${frame.screenId}:${queue.startIndex}:${queue.tracks.map((track) => track.key).join(',')}`
}

/** Compatibility projection; selection reconciliation belongs to music-management. */
export function derivePlaybackPresentation(frame: ScreenFrame, attempt: PlaybackAttempt | null, playback: PlaybackState, provider: MusicProvider): PlaybackPresentation {
  return deriveSelectionPresentation(playbackQueueForFrame(frame), playbackFrameKey(frame), attempt, playback, provider)
}

/** Projects common playback truth into the panel's visual phases. */
export function managedPlaybackPresentation(provider: MusicProvider): PlaybackPresentation {
  const { playback, intent } = musicManager(provider).getSnapshot()
  const base = { playback, selectedTrack: intent?.track ?? null, attemptApplies: intent !== null, settleAttempt: false }
  if (playback.status === 'error') return { ...base, phase: 'failed', track: playback.now }
  if (intent !== null || playback.status === 'loading') return { ...base, phase: 'starting', track: playback.now, usesSelectedTrack: intent?.track !== null && intent?.track !== undefined }
  if (playback.now !== null) return { ...base, phase: 'ready', track: playback.now }
  return { ...base, phase: 'empty', track: null }
}
