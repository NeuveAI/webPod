# Dispatch packet — W1 · Provider contract, fixture provider, capability stubs

**Status:** `Ready on W0` · **Lane:** L-B · **Blocked by:** W0 · **Informed by:** S1

## Read first
`scope.md` · `literature.md` rows: Effect, Bun · 001 `pm-spec.md` **§14 in full** — §14.2 is the interface you transcribe, §14.3 is the capability matrix, §14.4 is what the layer must never do, §14.5 is `TrackRef` identity · `evidence/apple-capability-spike.md` if S1 has landed.

## Correctness target
`packages/providers` exports the §14.2 `MusicProvider` interface **verbatim**, a fixture provider that is the day-one implementation, and compiling Apple and Spotify stubs whose `supports()` return their §14.3 columns — so parity gaps are visible in CI from day one rather than discovered in production.

## Non-negotiables from §14.3–14.5
- **Transcribe §14.2; do not redesign it.** If something looks wrong, log it and ask.
- `TrackRef` carries a `LocalKey` (UUIDv7, ours). **No internal structure may hold a provider id as a key** — queue, provenance and undo tokens accept `LocalKey` only. Verify this by type, not by convention.
- **Stars are absent from the interface on purpose** (§14.3 row 22). They are a local-only device rating, never synced. Do not add a `ratingStars` method.
- **Never map Love to Save** (row 23). Love is a taste signal; Save is library membership. Conflating them silently changes what a button means.
- `artworkUrl(a, px)` returns `{ url, actualPx }` and **never upscales a sharp image**. It must also return a **same-origin proxied URL** — cross-origin artwork will not paint into a canvas, and that is how both providers serve it. The proxy itself is `server-core`'s job later; the helper's contract is yours now.
- `unsupportedReason()` returns text that will be rendered **verbatim** to a user. Write it as product copy.
- **`grep -rn 'provider.id ===' src/ --exclude-dir=providers` must return 0.** Capability checks are `supports()` everywhere else. A `supports()` that returns `true` for something the provider lacks is the §15.3 failure mode 7 and is a blocking finding.
- **Absent, never disabled.** A capability the provider lacks produces no control at all — not a greyed one (U15).

## Apple, given H-2
The owner has no MusicKit token. **Apple ships as a compiling stub only** — `supports()` returns the §14.3 Apple column with every `UNVERIFIED` row set to **`false`** (a capability is absent until proven present); every method throws a typed `NotImplemented`. No network call to Apple or Spotify may be made from any code you write.

The **fixture provider is the launch implementation for 002.** It serves realistic library, album and track data so every screen has something honest to render. Its capability matrix must be **configurable per test**, so W3 can exercise the absent-not-disabled paths without a second provider.

## Verification
`bun test`: `supports()` matches the §14.3 matrix row-for-row (table-driven, one case per row); `artworkUrl` clamps at `actualPx` and never upscales; `TrackRef`/`LocalKey` identity survives a simulated provider switch; `unsupportedReason` non-null for every unsupported capability. Plus per-package tsc, lint, gates.

## Guardrails
Own `packages/providers/**`. Read `packages/tokens`. Never write `packages/state`, `packages/panel`, `apps/web`. **No network calls, no credentials, no signup.**

## Artifacts
`diary/w1.md` · `decisions/w1.md` (must name which `~/code/agentic-context/effect` files you read — Effect is **4.0.0-rc.112**: `Context.Service` not `Context.Tag`, `effect/unstable/http` not `@effect/platform`) · `evidence/w1-*` · review `reviews/w1-review.md` (lane L-B)

## Commits
`feat(providers): music provider contract` → `feat(providers): fixture provider` → `feat(providers): apple and spotify capability stubs`
