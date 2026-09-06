# Proposed browser/backend contract

Implemented device-session transport; owner chose browser/device identity for the first release. All mutable operations derive owner from server session, never request userId.

`@webpod/stickers` is the client-safe package for catalogue, policy response and placement contracts. It must import no server-core, Bun database or secrets. Catalogue uses all exact manifest IDs and build-resolved asset URLs. Backend owns package and dependency changes; surface consumes it.

## Placement

`StickerPlacement = { stickerId: string; surface: 'back'; x: number; y: number; width: number; rotationDeg: number }`.

One placement per stickerId; maximum 12. Coordinates are normalized rear-view body width/height, origin top-left; x/y is visible silhouette center. Width is visible artwork width relative to body width; clockwise rotation in rear view, normalized -180..180. Width .08..35. The complete rotated rectangle derived from manifest alpha visibleBounds must fit safe rear box x=.08..92, y=.06..94. Surface engineer supplies canonical body ratio so backend and renderer use identical height conversion. Only owned art may be placed. Revision-based updates reject stale revisions.

## Endpoints

- `POST /api/stickers/device`: bounded same-origin preparation establishing a restricted HttpOnly recovery cookie before any in-flight authorization. Never grants inventory access.
- `POST /api/stickers/session`: dedicated private MusicKit credential transfer; verify upstream before creating active session/import. No token in shared Session or Jotai. A separately verified active cookie grants access to the opaque owner mapped by the device cookie.
- `GET /api/stickers`: authenticated snapshot `{ inventory, packs, progress, placements, placementRevision, importStatus }`.
- `POST /api/stickers/listening`: bounded sequential observation batches with stable retry event IDs; returns refreshed progress/packs. Server determines credit and genre.
- `POST /api/stickers/packs/open`: `{ packId }`; idempotently opens persisted contents, never rerolls.
- `PUT /api/stickers/placements`: `{ revision, placements }`; validates full collection atomically, returns next revision.
- `DELETE /api/stickers/session`: cancel active session access; recovery identity survives; all active sessions and pending work are revoked by device generation. Fresh verified authorization recovers the same inventory.

All responses no-store. Errors stable bounded codes and safe user-facing copy. Same-origin mutation checks, JSON content type, body/array length caps, no upstream raw error body. Client handles pending, partial and retryable import independently of successful Apple music playback.

## Distribution

Lead scope clarification: a single starter pack contains up to three first catalogue stickers from the strongest distinct supported imported genres. Count distinct catalogue tracks; stable tie ordering by manifest genre order. No confident genre when metadata unknown. Library/recent membership credits zero listening duration.

Subsequent named v1 thresholds per genre: 5/15/60/180/600 cumulative observed minutes for first-through-fifth art; starter already grants first art in its genres, so next is 15 minutes. Unique grants owner+policy+genre+milestone guarantee retry/concurrency safety. Each newly earned pack contains its deterministic newly unlocked art; repeated threshold evaluation cannot create another grant.

Review correction: starter considers only unowned first-tier art from the up-to-three strongest supported genres. Once supported taste exists its single evaluation is consumed, including when all eligible art was already earned through listening. That all-owned case emits no empty pack, gives no higher-tier substitute and remains consumed on retries or changed taste. No supported genre leaves evaluation pending. Library membership and catalogue-resolution provenance are independent; a successful catalogue result that remains unknown is not refetched on every observation.

Import snapshots are all-or-nothing when a later page fails, times out or is malformed: preserve the previous persisted taste and grants, mark import failure, and retry the full bounded snapshot. `partial` specifically reports the declared 25-page/2,500-track cap, never a disguised network error.

Listening client observes provider playback/progress and sends about every ten seconds plus pause/track-change flush. Inputs include stream ID, event ID, monotonic sequence, stable Apple catalogue track ID, playback status and progress timestamp; exact shape will be published with implementation. Server bounds credited time by its own clock and plausible playhead movement, drops seeks/stalls/expired gaps, prevents concurrent tab double credit and atomically persists credit and awards. This is bounded client telemetry, not proof of Apple historical listening.

Device identity is random first-party persisted state, not hardware entropy. New browser/cleared cookies starts a new collection; another Apple account in this browser shares its interim collection. Active sessions last 24h, device recovery 365d. See architecture/sticker-backend.md for production setup, concurrency/rate bounds and cancellation guarantees.
