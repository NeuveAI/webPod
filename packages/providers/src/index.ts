/**
 * `@webpod/providers` — the music provider contract and its implementations.
 *
 * One interface, `MusicProvider`, transcribed from pm-spec §14.2, plus the
 * identity rules of §14.5 and the capability matrices of §14.3. Three
 * implementations: a fixture provider that is the day-one runtime, and Apple
 * and Spotify adapters that ship as compiling stubs carrying real capability
 * matrices — so a parity gap is visible in CI on day one rather than in
 * production later.
 *
 * **Two things a consumer of this package must know:**
 *
 * - Ask `supports()`. Never `provider.id === …` outside this package (§14.4).
 *   A capability the provider lacks produces **no control**, not a greyed one.
 * - Hold a `LocalKey`. Never a `catalogId`, a `libraryId` or a Spotify URI
 *   (§14.5). The compiler enforces this — `LocalKey` is a branded string, so a
 *   provider id will not typecheck in a key position.
 */

export * from './errors.ts'
export * from './identity.ts'
export * from './capability.ts'
export * from './artwork.ts'
export * from './domain.ts'
export * from './provider.ts'
export * from './reresolve.ts'
