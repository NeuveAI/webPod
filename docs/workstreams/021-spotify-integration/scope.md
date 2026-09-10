# Spotify integration

Status: Ready for local implementation; live OAuth consent may require owner action.

## Correctness and source of truth
User requests a new branch, an `or use Spotify` link beside Apple sign-in, a working integration tested in the existing browser, and Spotify credentials uploaded to Vercel production. Existing MusicProvider and navigation contracts define integration. Official Spotify authorization, SDK reference, and February 2026 changelog define external APIs; the old stub documentation is not authoritative for endpoints.

## Scope and decisions
Implement server authorization-code exchange with PKCE and state, encrypted HttpOnly session cookies, refresh and logout. Browser receives only short-lived access tokens required by the Playback SDK. Preserve Apple behavior and use provider-neutral navigation. Load Spotify SDK only for Spotify. Restore selected provider. Use current `/items` playlist endpoints and `/me/library` writes. Account/SDK errors must be visible. Spotify Premium and development-mode user allowlisting are external prerequisites. No new billing, account creation, app quota changes, Apple-key access, merge or production code deployment implied.

## Sources and types
Read packages/providers/src/{provider,domain,identity}.ts and installed TanStack server route sources. Official SDK reference: https://developer.spotify.com/documentation/web-playback-sdk/reference . Official API migration: https://developer.spotify.com/documentation/web-api/references/changes/february-2026 . Use @types/spotify-web-playback-sdk for SDK callbacks and Zod for intentionally minimal external REST domain schemas (current REST fields differ from older SDK types). The specified reference checkout is missing; installed dependencies are the fallback.

## Work and verification
1. Server auth: state/PKCE, bounded encrypted cookies, same-origin token/logout, no token logs. Verify focused request-level checks including rejection and expiration paths.
2. Provider: paginated library, entity mapping, SDK lifecycle, transport, queue and supported writes. Verify typecheck and existing provider/runtime tests plus browser playback.
3. Runtime/UI: alternate link, session restore and provider-specific errors/logout. Verify existing runtime tests and real landing/player route in Chrome.
4. Operations: safely pipe only requested env values to linked Vercel production project; verify names via env listing. Never print secrets.

DoD: typecheck, lint, relevant tests, build; live auth/library/playback checked or concrete external blocker recorded. No useState, no cert reads, no credential output. Agent may select routine implementation details within this scope. Owner must handle any consent UI when tool policy requires it.

## Evidence and history
Record verification and remaining external requirements in evidence.md; decisions and handover in that file. Commit plan: server OAuth, provider and runtime integration, UI and operational documentation, each with relevant checks. No independent implementation dispatch. Focused review lanes: auth security, SDK lifecycle, Apple regression. Work proceeds continuously under the user's instruction to get it working.
