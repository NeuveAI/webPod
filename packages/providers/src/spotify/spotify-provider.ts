/**
 * The Spotify adapter — a compiling stub with a real capability matrix.
 *
 * §14 requires that Spotify be *plannable without redesign*, and this is how
 * that is checked rather than asserted: the column is real, so every screen and
 * every tool roster can be exercised against a provider that lacks radio,
 * lyrics, Love and insert-next, today, with no account and no network.
 *
 * **No code in this module makes a network call to Spotify.**
 */

import type { MusicProvider } from '../provider.ts'
import { createStubProvider } from '../stub.ts'
import { SPOTIFY_SUPPORTS, SPOTIFY_UNSUPPORTED_REASONS } from './matrix.ts'

/**
 * Creates the Spotify adapter.
 *
 * @returns a provider whose capability matrix is §14.3's Spotify column and
 * whose behaviour is not implemented.
 */
export function createSpotifyProvider(): MusicProvider {
  return createStubProvider({
    id: 'spotify',
    displayName: 'Spotify',
    supports: SPOTIFY_SUPPORTS,
    unsupportedReasons: SPOTIFY_UNSUPPORTED_REASONS,
  })
}
