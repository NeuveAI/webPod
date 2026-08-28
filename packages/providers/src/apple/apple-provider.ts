/**
 * The Apple Music adapter — a compiling stub with a real capability matrix.
 *
 * Apple Music ships first, and this is not it. What is real here is
 * `supports()` and `unsupportedReason()`: the §14.3 column, evidenced row by
 * row in `matrix.ts`, so that a parity gap is a CI-visible fact from day one
 * rather than something the launch provider discovers in production. Every
 * other method throws a typed error.
 *
 * **No code in this module makes a network call to Apple.** The credentials
 * exist (D-016) and are server-side only (D-017); nothing client-side in this
 * slice touches them, and the developer token is minted in
 * `packages/server-core` when there is something to mint it for.
 */

import type { MusicProvider } from '../provider.ts'
import { createStubProvider } from '../stub.ts'
import { APPLE_SUPPORTS, APPLE_UNSUPPORTED_REASONS } from './matrix.ts'

/**
 * Creates the Apple Music adapter.
 *
 * @returns a provider whose capability matrix is authoritative and whose
 * behaviour is not implemented. See `matrix.ts` for the evidence behind every
 * value, and `relationships.ts` for the response-parsing hazard the real
 * implementation must route through when it arrives.
 */
export function createAppleProvider(): MusicProvider {
  return createStubProvider({
    id: 'apple',
    displayName: 'Apple Music',
    supports: APPLE_SUPPORTS,
    unsupportedReasons: APPLE_UNSUPPORTED_REASONS,
  })
}
