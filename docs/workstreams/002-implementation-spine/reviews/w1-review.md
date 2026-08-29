# Review: W1 — Provider contract, fixture provider, capability stubs

**Commits reviewed:** `5f2a3bc` · `5870447` · `5984dbc` · `b17ca75` · `8bb4e6b`
**Package:** `packages/providers/**` — 22 source files, 4,225 lines
**Reviewer posture:** antagonistic, per `review-system-prompt.md`. Every claim below was re-derived; nothing was taken from the diary.

## Verdict: REQUEST_CHANGES

Six Major findings. The slice's *research fidelity* is the best I have seen in this workstream — the §14.3 matrix is gated row-for-row and every capability flip I planted goes red — and its *enforcement claims* do not survive being tested. Three of the four things the tracker records as structurally enforced are not: the include-hazard arity guard, the `LocalKey` brand's third proof, and the §14.5 "no provider id as a key, verify by type" requirement. A settled lead ruling (D-052) never reached the code.

---

## The eight standing questions (D-038, D-040, D-045, D-048, D-047, D-050, D-049)

**1. D-038 Q1 — does any finding here contradict the method that produced the rest?**
Yes, and it is Major-3. I spent most of this review proving *values* correct — matrix rows, labels, copy — because the packet framed the risk that way. The three defects that matter are not values; they are the mechanisms claimed to protect the values, and each was one edit away from being checked. I found Major-2 (arity) and Minor-8 (the third `@ts-expect-error`) only after I stopped reading the enforcement and started breaking it. Had I stopped at "the matrix matches the spike, row for row" — which it does — I would have approved a slice whose D-029 containment can be reverted without turning a single test red. That is D-047 turned on the reviewer: *reading a guard is not testing a guard*.

**2. D-038 Q2 — for each conclusion endorsed, does the reason support it, or merely arrive at it?**
Three cases where it merely arrives:
- `decisions/w1.md` §3 defends `Session.canPlay` as a separate axis because "collapsing them would make 'signed in but silent' unrepresentable". The type represents it. The fixture ignores it — `createFixtureProvider({ canPlay: false })` plays (Major-4). The reason is correct and the conclusion it is offered for is not delivered.
- D-053(a) records three `@ts-expect-error` assertions as the proof of the brand. Two are load-bearing. The third passes for an unrelated reason (Minor-8).
- The tracker records the include hazard as "enforced structurally … with a test asserting the arity so it survives a rewrite." The arity test does not survive the most idiomatic rewrite (Major-2). Right conclusion (a status parameter must not exist), wrong mechanism.

**3. D-040 — a caution applied inconsistently is the finding.**
`apple/matrix.ts` carefully downgrades every absence row to `LIKELY · docs` under D-029/D-045. `spotify/matrix.ts` stamps `VERIFIED · docs` on four structurally identical absence claims (rows 17, 18, 21, 23) while hedging two others (rows 19, 20) to `LIKELY` — with no principle in the file dividing them, and with the file's own header conceding "Nothing here has been demonstrated against the running API." Minor-12.

**4. D-045 — name the evidence class; `VERIFIED` needs structural evidence.**
Apple's column does this correctly and is the strongest artefact in the slice. `SONG_RELATIONSHIPS` invents a four-value evidence class (`live-exists` / `live-gated` / `live-absent` / `docs-only`) and then discards it at the only gate that reads it: `assertKnownSongRelationship` treats a `docs-only` name exactly as a measured one (Minor-18).

**5. D-048 — a flag is not an answer.**
`decisions/w1.md` §8(a) flagged the shuffle/repeat gap correctly and escalated. The lead answered with **D-052, settled**. The flag is still in the code, still worded as an open question, in a comment that is now false (`fixture-provider.ts:184`: "logged in `decisions/w1.md` as a question for the lead"). The ruling landed in the log and never landed in the source. This is D-048's twin: the *resolution* was treated as the work, and the work never happened. Major-1. **It implicates the lead as much as W1** — D-052 was recorded as settled without a re-check that the code moved.

**6. D-047 — if it is empirically answerable cheaply, answer it.**
Three experiments that cost me under a minute each and were never run by author or lead: (a) add a defaulted `status` parameter and see whether the arity test fires — it does not; (b) delete the brand and count the unused-directive errors — two, not three; (c) pass a `catalogId` into `catalog.tracksByAlbum.get()` and typecheck — clean. All three were asserted as settled in the diary and the tracker. The unrun experiment I *cannot* close is the Apple playlist-write probe (needs a Music User Token) — correctly out of this slice's boundary, and correctly not relied upon.

**7. D-050 — plant a wrong value in every spec constant and confirm red.**
Done for 20 constants and behaviours; the full table with real results is at the end. The capability matrices, the union, its order, the artwork clamp, the proxy path and the relationship classifier are **all genuinely gated** — a marked improvement on W2. Two holes: `DURATION_TOLERANCE_MS` (Minor-7) and `ProviderId` membership (Minor-17).

**8. D-049 — is each invariant enforced where it is owned?**
No, in the sharpest available form. `identity.ts:136` exports `LocalKeyed<V> = ReadonlyMap<LocalKey, V>` with a docblock explaining that it exists so a map keyed by `catalogId` cannot be handed to our structures — and the same package then declares the only two such maps it owns as `ReadonlyMap<string, …>` (Major-3). The module that knows the rule exported it to a consumer that does not exist yet, and used a bare `as LocalKey` cast to get past its own type. `LocalKeyed` has zero usages repo-wide. Second instance: `progressTicks` / `artworkArbitrarySize` are stated three times in this package to hide no control, and their reasons are still emitted through the same undifferentiated channel B04 renders as "not available" (Minor-11).

---

## Findings

### Major

- **[MAJOR-1] D-052 is settled and unimplemented — `setShuffle` / `setRepeat` are absent from `MusicProvider`** (`packages/providers/src/provider.ts:170`, `packages/providers/src/fixture/fixture-provider.ts:180-187`, `packages/providers/src/capability-matrix.test.ts:57`).
  The interface ends at `saveToggle`. The fixture still holds `const shuffle: ShuffleMode = 'off'` / `const repeat: RepeatMode = 'off'` behind a comment reading *"adding `setShuffle` / `setRepeat` would be redesigning §14.2"* and *"logged … as a question for the lead"* — the pre-ruling state, verbatim. `capability-matrix.test.ts:57` hard-codes the pre-ruling justification into the §14.3 row-27 case (`"§14.2 supplies no method that sets either"`), so the test suite now actively asserts the state D-052 overturned. `grep -rn 'setShuffle\|setRepeat' packages/` returns three hits, all comments, none code.
  **Why it matters:** D-052 is not a suggestion — it is a settled ruling with a stated reason (both providers expose real endpoints; a device-local flag would be a control that appears to work and does not). B02 and the transport half of S13 are blocked on it, and the next lane will read `capability-matrix.test.ts:57` as the current truth. Per the prompt's instruction not to relitigate a recorded decision, I am checking compliance: there is none.

- **[MAJOR-2] The D-029 include-hazard guard is not structural — the arity test does not survive the rewrite it was written to survive** (`packages/providers/src/apple/relationships.test.ts:71-75`).
  `expect(readSongRelationship).toHaveLength(2)` relies on `Function.length`, which **stops counting at the first parameter with a default**. I planted:
  ```ts
  export function readSongRelationship(resource: AppleResource, name: string, status = 0): readonly unknown[] {
    assertKnownSongRelationship(name)
    // D-029 mistake, reintroduced: trust the 200.
    if (status === 200) return resource.relationships?.[name]?.data ?? []
  ```
  Result: **`tsc` exit 0, 230 pass, 0 fail.** The exact failure D-029 ruled against — treating a `200` as proof the relationship was honoured — is reintroducible with a status slot and every gate stays green. (An `status?: number` parameter *is* caught, arity 3 → red. A defaulted one is not, and a defaulted one is the idiomatic way to add a backward-compatible parameter.)
  **Why it matters:** `tracker.md:88` records this as *"Include hazard enforced structurally — … with a test asserting the arity so it survives a rewrite."* It does not. The correct enforcement is either a compile-time assertion on the function's type (`Parameters<typeof readSongRelationship>['length']` fixed at 2) or a test that asserts the *behaviour* under a third argument, not `Function.length`. On row 20 — the only `live` row in the whole matrix — this bug presents as "this song has no station" and would be read as a data condition.

- **[MAJOR-3] §14.5's "no internal structure holds a provider id as a key — verify by type" is unenforced in this package's own launch structure** (`packages/providers/src/fixture/catalog.ts:143,145`; `packages/providers/src/identity.ts:136`; `packages/providers/src/fixture/fixture-provider.ts:159`).
  `FixtureCatalog.tracksByAlbum` and `tracksByPlaylist` are declared `ReadonlyMap<string, readonly TrackRef[]>`. `LocalKeyed<V> = ReadonlyMap<LocalKey, V>` — the type written for exactly this job, with a docblock saying so — is exported and has **zero usages repo-wide**. `fixture-provider.ts:159` launders the raw key back into a `LocalKey` with a bare `as LocalKey` cast rather than the checked `asLocalKey()`.
  I proved the hole by type, which is the standard the packet sets. This file typechecks clean against the shipped package:
  ```ts
  export const byCatalogId  = catalog.tracksByAlbum.get(album.catalogId)
  export const byLibraryId  = catalog.tracksByAlbum.get('i.gLrJKQEsl5eL2q')
  export const bySpotifyUri = catalog.tracksByPlaylist.get('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')
  export const byGarbage    = catalog.tracksByAlbum.get('not-a-key-at-all')
  ```
  → `tsc_exit=0`.
  **Why it matters:** the packet's words are *"verify this by type, not by convention"*, and D-053(a) accepted a deviation from §14.2 **specifically** to make that achievable. The deviation was taken and then not applied where it counts. `FixtureCatalog` is public API of this package and W3/W4 consume `tracksByAlbum` directly. Two `ReadonlyMap<LocalKey, …>` annotations and replacing the cast with the already-typed key closes it.

- **[MAJOR-4] `Session.canPlay` and `authorized` are inert — the free-tier and signed-out states cannot be reached in the day-one runtime** (`packages/providers/src/fixture/fixture-provider.ts:162-172`, `:404-423`, `:321-336`).
  Measured:
  ```
  createFixtureProvider({ canPlay: false })  → play({album}) → status = 'playing', now = 'Syndicate'
  createFixtureProvider({ authorized: false }) → session = null, libraryList('songs').total = 42, search → 10 hits
  await unauthorize()                        → session = null, libraryList('songs').total = 42
  ```
  No method consults `session` or `canPlay`. §14.3 row 3 makes free-tier Spotify **(d) refuse** — browse-only, `Playback needs Spotify Premium.` on S13 — and §11.5 has its own copy for the signed-out state.
  **Why it matters:** §15.3 failure 8, verbatim: *"Silently dropped states… You must be able to reach each one."* The fixture is the **only** provider W3 can drive (Apple and Spotify throw on every method), so if the fixture cannot produce "signed in but silent" or "signed out", those two screens will be built untested against anything. The empty-catalogue path for §11.6 was thought through and works; these two were not, and no principle in the file separates them (D-040 at the fixture level). `decisions/w1.md` §3 argues for `canPlay` on precisely the grounds this defeats.

- **[MAJOR-5] `saveToggle()` writes a set nothing reads — Save is a no-op on the launch implementation** (`packages/providers/src/fixture/fixture-provider.ts:154`, `:582-587`).
  `savedKeys` is written by `saveToggle` and read by nothing, in this package or any other. Measured: library total 42 before and after `saveToggle(track, true)`; after `libraryRemove(track)` + `saveToggle(track, true)` the library holds 41. Its own TSDoc calls it *"Library membership"*, and §14.3 row 24 makes Save and add-to-library **one operation with two labels** (`POST /v1/me/library` on Apple; `PUT /me/tracks` on Spotify — the same endpoint `libraryAdd` uses).
  **Why it matters:** the fixture's job is to be honest enough that a screen built against it is a screen. A `Save` control wired to this changes nothing observable and cannot be read back. `fixture-provider.test.ts:221` ("Love and Save are different stores") tests only that `ratingSet` does not move the library — the correct half — and never asserts that `saveToggle` moves anything, so the defect is invisible to the suite. Note this finding does **not** ask for Love→Save: it asks that Save do what §14.3 row 24 says Save is.

- **[MAJOR-6] The two implementations of `MusicProvider` disagree on the failure protocol — the stubs throw synchronously from `Promise`-declared members** (`packages/providers/src/stub.ts:80-83` and every method at `:100-237`).
  `gate()` returns `never` and every stub method is `return gate(...)` — a plain function, not `async`. Measured:
  ```
  apple.search({...})              → THREW SYNCHRONOUSLY: NotImplementedError
  fixtureProvider.search({...})    → returned a promise (rejection)
  Promise.all([apple.queueRead(), apple.stationsList()]) → throws before Promise.all is entered
  ```
  **Why it matters:** the declared type is `Promise<SearchResults>`. `provider.search(q).catch(handle)` and `void provider.play()` are the two shapes a UI actually writes; both are handled on the fixture and both crash the caller on Apple/Spotify. `stub.test.ts:99-118` does `await call(provider)` inside a `try`, which is the one shape that masks the difference, so the suite cannot see it. It is also undocumented — the TSDoc on every stub method says only "Not implemented." Marking the stub methods `async` is a one-word fix per method and makes the two implementations agree.

### Minor

- **[MINOR-7] `DURATION_TOLERANCE_MS` is not gated (D-050)** (`packages/providers/src/reresolve.ts:25`, test at `packages/providers/src/reresolve.test.ts:65`). §14.5 states `±2000ms` as a literal ruling. Planting `500`, `3000` and `30000` each leaves **230 pass, 0 fail, tsc 0**. The only test that touches the value writes `durationMs: 224_000 + DURATION_TOLERANCE_MS` — both sides derived from the symbol under test, which is D-050's named anti-pattern verbatim. At 30 s tolerance a live cut and a studio cut of the same song are silently promoted from `low` to `metadata`, which is exactly the "we never silently rebuild a queue that is 78% of what it was" harm §14.5 exists to prevent. Assert `expect(DURATION_TOLERANCE_MS).toBe(2000)` against the § and use literals in the rung-2 case.

- **[MINOR-8] Only two of the three `@ts-expect-error` brand proofs are load-bearing** (`packages/providers/src/identity.test.ts:104-107`). Planting `export type LocalKey = string` yields exactly two `TS2578: Unused '@ts-expect-error' directive` errors — lines 93 and 99. Line 105 survives because `ref.libraryId` is `string | undefined`, which fails the `LocalKey` parameter for **optionality**, not for branding. D-053(a) records all three as the proof and calls it "the strongest available form". Use `ref.libraryId ?? ''`, or a non-optional `libraryId`-typed local, to make it test what it claims.

- **[MINOR-9] The row-10 comment contradicts the spike it cites, twice** (`packages/providers/src/apple/matrix.ts:83-85`). Code: *"the only `DELETE` verbs in the entire API are the **ten** ratings deletions"*. `apple-capability-spike.md:109`: *"Across the whole API there are **nine** `DELETE` endpoints, all ratings."* Same comment: *"'Creating and Modifying User Playlists' has exactly **three entries**"*; the spike says the group holds **five entries** — three endpoints and two request objects. This comment's entire purpose is to stop a future reader re-deriving a wrong conclusion (its own `⚑` says so); a count that disagrees with the source it names undermines that.

- **[MINOR-10] Two `unsupportedReason()` strings are not the product copy the contract asks for** (`packages/providers/src/apple/matrix.ts:162`, `:174-175`).
  `Apple Music doesn’t give webPod the words.` — §11.0 rule 1 is "name the concrete thing"; the feature is called **Lyrics** on B04, S16 and the centre-cycle, and this substitutes a euphemism for it. §11.0's opening line is "Never cutesy." It is also inconsistent with the sibling string on the same §14.3 row, `Spotify doesn’t offer lyrics to other apps.` (taken verbatim, correctly), and with the spike's own suggested copy `Apple Music doesn't make lyrics available to other apps.`
  `Apple Music playlists can only be added to from here.` reads as *"the only place these playlists can be added to is webPod"*, which is false. The spike's suggested copy — `Apple Music only lets other apps add to a playlist.` — says the true thing. Both strings are rendered **verbatim** to a user.

- **[MINOR-11] `progressTicks` and `artworkArbitrarySize` emit reasons through the channel reserved for capabilities that hide a control (D-049)** (`packages/providers/src/spotify/matrix.ts:150-151`; contrast `provider.ts:131-139`, `stub.ts:182-191`, `fixture-provider.ts:483-490`, which each state that a `false` here hides nothing). §14.4 sends `unsupportedReason()` to B04 and S27 as the explanation for something the user cannot have. On Spotify, live position and artwork both work — interpolated and at 640 — so B04 would list two working features as unavailable. This package is the one that knows the difference and says so three times; it has no way for a consumer to act on it. Either exclude these two from the surfaced roster at this boundary, or carry the distinction in the return type.

- **[MINOR-12] Spotify's absence rows carry `VERIFIED · docs` where Apple's structurally identical ones were downgraded to `LIKELY`, with no stated principle (D-040/D-045)** (`packages/providers/src/spotify/matrix.ts:49,52,55,76,89`). Rows 17, 18, 21 and 23 are `VERIFIED · docs` negatives resting on published-docs prose — textbook testimonial evidence, which D-045 (LAW) says may not carry `VERIFIED` alone. Rows 19 and 20, the same kind of claim, are hedged to `LIKELY`. The file's own header concedes *"Nothing here has been demonstrated against the running API"* and then stamps `VERIFIED` four times anyway — D-048's "flagging a tension instead of resolving it". No `supports()` value moves; the label is the point, for exactly the reason D-029 gives: someone will reopen this and say "we verified it". Row 19 is the tell — Spotify **withdrew** those endpoints in Nov 2024, which is the archetype of a claim that goes stale silently.

- **[MINOR-13] A malformed or negative `Cursor` silently returns page 0 with a non-null `next`** (`packages/providers/src/fixture/fixture-provider.ts:236-242`). `libraryList('songs', 'not-a-cursor')` and `libraryList('songs', '-5')` both return the first 25 items and `next: '25'` — indistinguishable from a legitimate first page. `errors.ts:1-11` sets the taxonomy standard ("catch blocks produce structured outcomes, never a `null` that silently triggers a hidden fallback"); this is the same hidden fallback in arithmetic form. A UI that appends on a stale cursor will duplicate rows rather than fail.

- **[MINOR-14] A legal-JSON `null` relationship value escapes the module's own error taxonomy** (`packages/providers/src/apple/relationships.ts:123-130`). `readSongRelationship(JSON.parse('{"id":"x","relationships":{"station":null}}'), 'station')` throws `TypeError: null is not an object (evaluating 'relationship.data')`. `errors.ts:4-7` states that consumers narrow on `_tag`; a bare `TypeError` has none, so the caller's D-029 branch is bypassed. This module's stated job is being the containment for a payload whose shape cannot be trusted, and it dereferences an unvalidated value one line after validating the key's presence. `relationship === null` needs the same treatment as `undefined`.

- **[MINOR-15] Roughly 15 of `MusicProvider`'s members carry no TSDoc** (`packages/providers/src/provider.ts:54, 94-96, 107, 123-126, 129-130, 144-145, 155-156, 160`). `search`, `libraryList`, `libraryAdd`, `playlistCreate`, `play`, `pause`, `skip`, `seek`, `playback`, `onPlaybackChange`, `queueRead`, `queueAppend`, `stationsList`, `stationStart` and `lyrics` are undocumented on the canonical interface every implementation reads. Several have non-obvious contracts that the two implementations already answer differently — `libraryList`'s cursor semantics (Minor-13), `play()` with no target, what `stationStart` returns when the station already exists. The documented members are excellent; the gap is that the ones with a `⚑` got prose and the ones without got nothing, which is a coverage rule rather than a principle.

- **[MINOR-16] The stubs' subscription members and getters do not throw `NotImplementedError`, and the departure is not logged** (`packages/providers/src/stub.ts:111-118`, `:174-191`). The packet's words are *"every method throws a typed `NotImplemented`"*. `session`, `playback`, `onSessionChange`, `onPlaybackChange` and `onProgress` instead return `null` / `IDLE` / a no-op unsubscribe. `onProgress` genuinely must not gate (§14.3 row 25) and the choice is defensible for the rest — but a caller cannot distinguish *"this provider will never call you back"* from *"nothing has changed yet"*, which is a screen frozen with no signal. `decisions/w1.md` §2 promises *"Anyone diffing this package against §14.2 will find exactly these"* deviations; this one is not among them.

- **[MINOR-17] `ProviderId`'s membership is not gated (D-050)** (`packages/providers/src/identity.ts:32`). Planting a fourth member (`| 'tidal'`) leaves **230 pass, tsc 0**. D-053(b) is a settled ruling on exactly which three ids exist; nothing asserts it. (Renaming `'fixture'` does go red, but only as a cascade of `TS2322`s from literal usage in `catalog.ts` — incidental, not a spec assertion.) One `expect` over a hand-written literal list, as `capability.test.ts:13-24` already does so well for `Capability`, closes it.

- **[MINOR-18] `assertKnownSongRelationship` discards the evidence class its own registry carries (D-045)** (`packages/providers/src/apple/relationships.ts:84-87`, registry at `:56-72`). `RelationshipEvidence` distinguishes measured (`live-exists`) from unmeasured (`docs-only`), and the gate treats them identically: a `docs-only` name passes exactly as a live-measured one does. Apple's documentation is the surface D-029 proved unreliable, so a `docs-only` name that does not exist will pass this gate, return `200`, and surface as `RelationshipNotHonouredError` — whose message tells the caller *"the request was not honoured; do not read this as 'no data'"*, when in fact **the name was wrong**. The module's two failure modes are correctly separated for measured names and collapsed for unmeasured ones. The docblock is right that the registry is not an existence oracle; the gate does not act on that.

---

## Verified clean — checked and found correct

These were attacked and held. Recorded so the next reviewer does not re-run them.

- **The §14.3 matrix matches the spike row for row.** 25 keys; `ratingStars` absent (D-026); `offline` absent (D-019); `stationSeedFromTrack: true` on Apple (D-028); rows 10/11/18/7 all `false` and all labelled `LIKELY`, never `VERIFIED` (D-029); the lyrics comment carries the real reason — exists, `400`/`40012`, entitlement unresolved, *"Do not route around 40012"* (`apple/matrix.ts:117-136`). Apple: 7 false / 18 true, matching the paste-ready block at `apple-capability-spike.md:437-475` exactly. Every Spotify value matches §14.3's column.
- **`capability-matrix.test.ts` is a real gate, not a tautology.** §14.3 is re-transcribed by hand from the spec rather than imported from the matrices, all 30 rows are present and numbered, the five rows with no union member are each asserted with their reason, and every capability is proven to appear in exactly one row. Six planted capability flips → red every time. This is the pattern D-050 asks for, done properly.
- **`artworkUrl` honours all three parts of the contract.** Returns `{url, actualPx}`; never upscales (1400 → 640, 65 → 300, 4000 → 3000 against a recorded ceiling); the URL is root-relative and therefore same-origin by construction, with `ARTWORK_PROXY_PATH` exported so `server-core` binds the same constant. Five planted violations — dropping the clamp, ignoring the template ceiling, pointing the path at a CDN host, returning the raw upstream URL, always picking the largest size — all red.
- **`grep -rn 'provider.id ===' --exclude-dir=providers` → 0 matches.** The inverse also holds: `.id === 'apple'|'spotify'|'fixture'`, `=== "apple"`, `case 'spotify'`, `isApple`/`isSpotify`/`providerIs` — the only hits repo-wide are three comments inside `packages/providers` quoting the rule.
- **Love is never mapped to Save.** `ratingSet` writes `loveByKey` and touches nothing else; `saveToggle` writes `savedKeys`; the two share no code path; Spotify's Love reason offers no substitute; the matrix test asserts independence on both providers.
- **Absent, never disabled.** No `disabled`/`greyed` flag is returned anywhere; the only occurrences are doc comments restating the prohibition.
- **No network call anywhere in the package.** `grep -rniE 'fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon'` → 0. `stub.test.ts:144-172` replaces `globalThis.fetch` with a throwing stand-in — without a cast — and asserts a call count of 0. Every `https://` literal is artwork test data.
- **Type escapes.** No `any`, no `as unknown`, no non-null assertion, no `eslint-disable`, in the whole package. Four `as` casts outside tests: `as const satisfies Record<Capability, true>` (load-bearing — dropping a union member turns it red), `Object.keys(...) as Capability[]`, the UUID template literal, and `Object.fromEntries(...) as CapabilityMatrix`. The three `@ts-expect-error` are the branded ones (see Minor-8 for the third). The one genuine laundering cast is `fixture-provider.ts:159` (Major-3).
- **Naming hygiene.** `grep -rn '002\|implementation-spine\|workstream' packages/providers/src` → 0 matches. The two fixes in `b17ca75` are real (42 ISRCs, one comment). *(Outside W1: `packages/composite/src/capabilities.ts:391` and `scripts/w4-tune.ts:4` both contain "workstream" — W0/W4 territory, not this review's.)*
- **§15.3 failure 1 (fake permission language)** — every hit is §14.2's own `authorize` / `unauthorize` / `authorized` (real OAuth vocabulary) or `Session.canPlay`'s "permits playback". Nothing agent-adjacent.
- **Process.** Every commit touches only `packages/providers/**` plus this workstream's own docs; no `Co-Authored-By` or session trailer on any of the five; each commit typechecks and passes standalone via `git archive` (59 → 99 → 229 → 230 → 230 tests, `tsc` exit 0 at all five).
- **Grounding.** `decisions/w1.md:18-20` names three `~/code/agentic-context/effect` paths; I opened all three. `packages/effect/package.json` is `4.0.0-rc.112`; `LLMS.md:122` is "Writing Effect services" / `Context.Service`; `ai-docs/src/50_http-client/10_basics.ts` exists. The conclusion — that Effect belongs on the server per §14.1 and this browser-side package should not import it — is correct and is the right call.

---

## Gates I cannot clear (owner-only, stated rather than passed over)

- **U14 — thumb occlusion (H-5).** Needs a phone in a hand. Not reachable here and not reachable by any reviewer of a headless package.
- **The both-colourway aesthetic call (H-6).** W1 renders nothing; there is no light/dark surface in this slice to judge. Both remain open against the screens that consume this package, and neither is discharged by this review.

---

## Suggestions (non-blocking)

- `apple/matrix.ts:174-175` gives `lyrics` and `lyricsSynced` the identical string; B04 would show the same sentence on two rows. `lyricsSynced`'s real reason ("the body has never been seen") differs.
- `spotify/matrix.ts:24` labels Spotify's `libraryRemove` `VERIFIED · docs` where §14.3 row 7's confidence cell reads `LIKELY (Apple: not supported)`. Reading the parenthetical as scoping the hedge to Apple is defensible and probably right — but say so in the comment, since it is the one row in the table whose confidence cell is not a clean split.
- `fixture-provider.ts:218` names a local function `require`. Harmless in ESM, but it shadows a word every reader has a strong prior about.
- `artwork.ts:118`: for a `template` artwork with no recorded `sizes`, `actualPx` is whatever was asked for, including 9000. Apple's templates top out near 3000. A documented ceiling constant would make the "never upscale" promise true rather than conditional on adapters remembering to populate `sizes`.
- The fixture pairs real recordings (Rumours, For Emma) with **fabricated ISRCs** shaped as real ones. ISRC is the top rung of the re-resolution ladder; a comment marking them synthetic would stop someone treating one as ground truth.

---

## Gates I ran myself

| Command | Real result |
|---|---|
| `bunx tsc --noEmit -p packages/providers/tsconfig.json` | exit 0, no output |
| `bun run typecheck` | `11/11 projects clean`, exit 0 |
| `bun test packages/providers` | **230 pass, 0 fail**, 1272 expects, 8 files |
| `bun test` (repo) | **413 pass, 0 fail**, 1868 expects, 15 files |
| `bunx --bun eslint packages/providers` | exit 0, no output |
| `bunx --bun eslint .` | 2 errors, 1 warning — **all in `apps/web/src/routes/[_]spike.device.tsx` and `scripts/w4-tune.ts`**, the live device lane's uncommitted files. Not W1's; not counted against this slice. |
| `bun run gates` | `bun run gates: not implemented`, exit 1 — the script is a stub repo-wide, not a W1 regression |
| `git archive <sha>` → `tsc` + `bun test` for all five commits | `5f2a3bc` 59 pass · `5870447` 99 · `5984dbc` 229 · `b17ca75` 230 · `8bb4e6b` 230; `tsc` exit 0 at every one. **Diary claim verified.** |
| `git log -1 --format=%B` × 5 grepped for `co-authored\|claude\|session\|🤖` | no trailer on any commit |
| `git show --name-only` × 5 | only `packages/providers/**` and this workstream's own `docs/` |
| `grep -rn 'provider.id ===' apps packages scripts --exclude-dir=providers` | 0 matches (exit 1) |
| `grep -rniE "\.id\s*[!=]==?\s*['\"](apple\|spotify\|fixture)"` and `(===\|!==\|case)\s*['"](apple\|spotify)['"]` | 3 matches, all doc comments inside `packages/providers` |
| `grep -rn "isApple\|isSpotify\|providerIs"` | 0 matches |
| `grep -rn "002\|implementation-spine\|workstream" packages/providers/src` | 0 matches (exit 1) |
| `grep -rniE "disabled\|greyed\|grayed" packages/providers/src` | 9 matches, all doc comments restating the prohibition |
| `grep -rnE "\bas any\b\|as unknown\|@ts-ignore\|eslint-disable\|!\." packages/providers/src` | 0 matches |
| `grep -rn "LocalKeyed" packages apps scripts` | 1 match — its own declaration. Zero usages. |
| `grep -rn "setShuffle\|setRepeat" packages/` | 1 match, a comment in `fixture-provider.ts` saying it was **not** done |
| `grep -rn "shuffle\|repeat" packages/state packages/panel apps/web -i` | nothing holding shuffle/repeat as local state — D-052 is unimplemented, not implemented in the wrong place |
| `bunx tsc` over a probe importing `FixtureCatalog` and calling `.get(catalogId)` / `.get('i.xxxx')` / `.get('spotify:playlist:…')` | **exit 0** — Major-3 |
| Runtime probe: `{"relationships":{"station":null}}` | `TypeError: null is not an object` — Major/Minor-14 |
| Runtime probe: stub vs fixture failure protocol | stub **throws synchronously**; fixture **rejects** — Major-6 |
| Runtime probe: `canPlay:false`, `authorized:false`, post-`unauthorize()` | plays; 42 songs; 42 songs — Major-4 |
| Runtime probe: `saveToggle` observability | 42 → 42; after remove+save, 41 — Major-5 |
| Runtime probe: cursor `'not-a-cursor'`, `'-5'` | both return page 0 with `next:'25'` — Minor-13 |

**Working-tree discipline:** every mutation below was applied with `perl -i` to a byte-identical copy taken before the review and restored from that copy immediately after. `diff -r` against the backup and `git status --short packages/providers` are both empty at the end of this review. Nothing was staged, committed, added or reset.

## Violations I planted, and what happened

| # | Planted | tsc | tests | Gated? |
|---|---|---|---|---|
| 1 | `APPLE_SUPPORTS.stationSeedFromTrack` `true → false` (undo D-028) | 0 | 224 pass / **6 fail** | ✅ |
| 2 | `APPLE_SUPPORTS.lyrics` `false → true` (invent an entitlement) | 0 | 229 / **1 fail** | ✅ |
| 3 | `APPLE_SUPPORTS.playlistRemoveTracks` `false → true` (§14.3's highest-risk row) | 0 | 229 / **1 fail** | ✅ |
| 4 | `SPOTIFY_SUPPORTS.ratingLoveDislike` `false → true` (fake Love parity) | 0 | 228 / **2 fail** | ✅ |
| 5 | `SPOTIFY_SUPPORTS.queueInsertNext` `false → true` | 0 | 229 / **1 fail** | ✅ |
| 6 | `SPOTIFY_SUPPORTS.stations` `false → true` | 0 | 229 / **1 fail** | ✅ |
| 7 | `Capability` union: drop `lyricsSynced` | **2** | 226 / **4 fail** | ✅ |
| 8 | `Capability` union: reorder two members | 0 | 229 / **1 fail** | ✅ (order is asserted) |
| 9 | `LocalKey` brand removed → plain `string` | **2** | 230 / 0 | ⚠️ **two** unused-directive errors, not three — **Minor-8** |
| 10 | `ProviderId`: `'fixture' → 'demo'` | **2** | 230 / 0 | ~ red only as a cascade from literal usage |
| 11 | `ProviderId`: add a fourth member `'tidal'` | 0 | **230 / 0** | ❌ **Minor-17** |
| 12 | `artworkUrl`: `actualPx = wanted` (upscale a sharp image) | 0 | 227 / **3 fail** | ✅ |
| 13 | `artworkUrl`: ignore the template's native ceiling | **2** | 229 / **1 fail** | ✅ |
| 14 | `ARTWORK_PROXY_PATH → 'https://cdn.example.com/artwork'` (cross-origin) | 0 | 228 / **2 fail** | ✅ |
| 15 | `artworkUrl`: return the raw upstream URL, no proxy | 0 | 228 / **2 fail** | ✅ |
| 16 | `artworkUrl`: fixed branch always picks the largest size | 0 | 229 / **1 fail** | ✅ |
| 17 | `readSongRelationship(resource, name, status?: number)` (arity 3) | 0 | 229 / **1 fail** | ✅ |
| 18 | **`readSongRelationship(resource, name, status = 0)` + `if (status === 200) return …data ?? []`** | **0** | **230 / 0** | ❌ **MAJOR-2** — D-029 reintroduced, everything green |
| 19 | `readSongRelationship`: absent key returns `[]` instead of throwing | 0 | 229 / **1 fail** | ✅ |
| 20 | `classifyRelationshipResponse`: collapse `40012` into `40008` | 0 | 228 / **2 fail** | ✅ |
| 21 | `DURATION_TOLERANCE_MS` `2000 → 3000` | 0 | **230 / 0** | ❌ **Minor-7** |
| 22 | `DURATION_TOLERANCE_MS` `2000 → 500` | 0 | **230 / 0** | ❌ |
| 23 | `DURATION_TOLERANCE_MS` `2000 → 30000` | 0 | **230 / 0** | ❌ |
| 24 | `reresolve`: relabel the `low` rung as `metadata` | 0 | 229 / **1 fail** | ✅ |
| 25 | `reresolve`: keep the original `provider` field across a switch | 0 | 229 / **1 fail** | ✅ |
| 26 | fixture `PAGE_SIZE` `25 → 7` | 0 | 230 / 0 | (not a spec ruling — noted, not a finding) |

**Score: 20 of 26 plants caught.** The capability matrices, the union and its order, the artwork contract and the relationship classifier are properly gated — better than W2. The four uncaught plants are all *guards*, not *values*, and each corresponds to a Major or Minor above.

---

# Final re-review — W1 providers at `9d6979a`

**Review date:** 2026-08-28  
**Implementation range rechecked:** `5f2a3bc` through `9fc2633`, including the thirteen review-response commits through `116016b`  
**Posture:** fresh antagonistic pass. The implementation was not edited. The original review above remains intact.

## Verdict: REQUEST_CHANGES

The original six Majors and twelve Minors are closed in the code that was written to close them. That does **not** make W1 approvable. Fresh execution through the fixture found three untested user-visible lies in the day-one provider, the decision artifact still describes the exact arity mechanism D-062 invalidated, and the workstream's mandatory static gate remains an intentional placeholder. Five Major findings therefore block approval.

## Review setup and source record

- **Repo law:** `AGENTS.md` in full. Per its explicit rule and D-002, this repo has no Neuve shell or Kanban board; `tracker.md` is the queue. No ticket was invented and no Neuve command was run.
- **Scoping and dispatch:** `scope.md`, `dependency-graph.md`, `hitl-decisions.md`, `review-system-prompt.md`, `review-lanes.md`, `dispatch/W1-providers.md`, and the full current `decision-log.md`.
- **Primary product source:** 001 `pm-spec.md` §14.0–14.6, including the exact §14.2 interface, all thirty §14.3 rows, §14.4's prohibitions, and §14.5 identity semantics.
- **W1 record:** `diary/w1.md`, `decisions/w1.md`, all four `evidence/w1-*` artifacts, and the complete prior review above.
- **Skills:** `/strict-critique`, `/team-orchestration`, its review protocol, `/workstream-scoping`, `/effect-services`, and `/global-patterns`. The last two still point at the nonexistent `~/code/agent-context`; that stale path was not used.
- **Canonical dependency sources, read directly under the required root:** `/Users/vinicius/code/agentic-context/effect/packages/effect/package.json` (`4.0.0-rc.112`), `/Users/vinicius/code/agentic-context/effect/LLMS.md` §“Writing Effect services” (`Context.Service`), and `/Users/vinicius/code/agentic-context/effect/ai-docs/src/50_http-client/10_basics.ts` plus the package export map (`effect/unstable/http`). The W1 conclusion still holds: Effect belongs in server token work under §14.1, not in this browser-side Promise contract.

## D-038 / standing-method questions

1. **Does a finding contradict the method used for the rest?** Yes. The repaired suite is unusually strong on the exact defects already named, but the fixture's claim that full support is “honest” was accepted from method coverage rather than exercised across every reference kind and every request field. Track Save was tested; album and playlist membership were not. Search normalization was tested; search scope and cursor semantics were not. That asymmetry produced Majors 1–3.
2. **Does each endorsed reason support its conclusion?** No. “The fixture holds its own data” supports *being able to implement* all capabilities; it does not support `FIXTURE_FULL_SUPPORT` while `libraryAdd(playlist)` is a no-op and album removal changes the wrong library slice. Likewise, a green relationship test supports the current type guard, while the decision artifact still endorses the old runtime arity guard. The conclusion and the recorded reason have diverged.
3. **Are cautions applied consistently?** No. W1 correctly insists that Save must change something readable, but the same observability test is absent for two of the three reference kinds accepted by `libraryAdd`/`libraryRemove`, and for the `scope`/`cursor` fields it invented on `SearchQuery`.
4. **Did every mutation prove it landed?** Yes for this pass. Each scratch mutation was grepped before its gate ran. Adding `RelationshipRead.status` made tsc fail; removing the `LocalKey` brand produced seven `TS2578` errors; making stub `search()` synchronous failed `stub.test.ts`; changing a Spotify false row to `VERIFIED · docs` failed `evidence-labels.test.ts`.

## Findings

### Major

- **[MAJOR-1] The fixture ignores both request fields that distinguish one search from another: `scope` and `cursor`** (`packages/providers/src/domain.ts:68-81`, `packages/providers/src/fixture/fixture-provider.ts:382-399`). The public type and `MusicProvider.search` documentation promise separate library/catalogue searches and an opaque cursor for more results. The implementation searches the complete catalogue for both scopes, never reads `q.cursor`, and always returns `next: null`. Measured after removing the first song from the library: a `scope: "library"` search still returned that removed song. A blank catalogue search with `limit: 10` returned 10 of 42 tracks with `next: null`; repeating it with `cursor: "10"` returned the same first item. The only search test checks normalization (`fixture-provider.test.ts:350-354`), so every current gate stays green. **Why it matters:** S12's library/catalogue scope chip and its no-results copy cannot be built honestly against the day-one provider, and 32 catalogue results become unreachable through the declared contract. This is §15.3 failure 8 (a state silently dropped) and failure 10 (a rendered fact the source does not supply).

- **[MAJOR-2] `libraryAdd` / `libraryRemove` only model track membership; their advertised album and playlist variants either mutate the wrong slice or do nothing** (`packages/providers/src/provider.ts:126-141`, `packages/providers/src/fixture/fixture-provider.ts:402-439`). `libraryList("albums")` is always the immutable `catalog.albums`; adding an album adds all its tracks to the **songs** set, and removing an album deletes all its songs while the album remains listed. `libraryAdd(playlist)` has no branch at all. Measured: removing an 11-track album changed songs `42 → 31` while albums stayed `4 → 4`; adding a fresh playlist left playlists `2 → 2`. Existing behavior tests exercise only `TrackRef` (`fixture-provider.test.ts:236-307`). **Why it matters:** §14.2 explicitly accepts `TrackRef | AlbumRef | PlaylistRef`, and §14.3 row 5 distinguishes saved tracks, albums and playlists. A full-support fixture that changes a different library when an album is removed, and reports success for a playlist write that changed nothing, invents parity and teaches consumers the wrong data model.

- **[MAJOR-3] Playlist writes leave the published `PlaylistRef.trackCount` stale** (`packages/providers/src/fixture/fixture-provider.ts:188-194`, `:441-489`). Track arrays are mutated in `playlistTracks`, but the `PlaylistRef` objects returned by `libraryList("playlists")` are never replaced or updated. Measured on the six-track “Late shift” fixture: after `playlistAddTracks(..., [track])`, playing the playlist traversed seven tracks while the listed ref still reported `trackCount: 6`. No test reads a playlist after any write; the existing cases only prove capability trips and session gates. **Why it matters:** `trackCount` is a user-visible provider fact. Rendering six while seven will play is the precise “fact the platform never supplies” failure the review prompt treats as a rejection condition, and it means W3 can build a permanently stale playlist row against a green fixture.

- **[MAJOR-4] The W1 decision artifact still endorses the exact arity guard D-062 proved false** (`docs/workstreams/002-implementation-spine/decisions/w1.md:264-276`; same stale historical claim at `diary/w1.md:96-99`). It says `readSongRelationship(resource, name)` and “a test asserts the arity is 2, so the enforcement is structural.” Current code correctly uses `readSongRelationship(read: RelationshipRead)` and compiler-level exact-key/tuple assertions because `Function.length` was defeated by a defaulted third parameter. The later response text explains the correction, but §7—the section explicitly titled as the current containment—was never amended or marked superseded. **Why it matters:** this is not harmless old prose. The decision file is the implementer's durable guide to a non-obvious adapter hazard, and it currently instructs the next adapter author to trust the mechanism whose failure produced the original Major. Under the strict-review documentation gate, misleading documentation for a major boundary is blocking.

- **[MAJOR-5] The mandatory static gate cannot run, so W1's Definition of Done is not satisfiable** (`docs/workstreams/002-implementation-spine/scope.md:87-92`, `scripts/gates.ts:1-9`, `docs/workstreams/002-implementation-spine/evidence/w1-gates.txt:56-67`). The scope says every slice requires `bun run gates` to return zero findings. It currently exits 1 with `bun run gates: not implemented`; W1's evidence acknowledges this and substitutes hand-run greps. Those greps are useful and were rerun, but they are not the workstream gate required by the binding scope. **Why it matters:** an explicit required verifier is missing, not merely red. An antagonistic final review cannot convert “W5a is unstarted” into approval, because that would redefine the DoD around the implementation already present. This is a workstream dependency/process blocker rather than a defect W1 should patch outside its ownership, but it still blocks the W1 verdict.

### Minor

- **[MINOR-1] Apple matrix provenance contradicts itself in its header** (`packages/providers/src/apple/matrix.ts:4-12`, compared with `:125-147`). The header says exactly one row is closed at `live`, `stationSeedFromTrack`; both `lyrics` and `lyricsSynced` are also labelled `VERIFIED · live` and the evidence-label gate deliberately preserves them. The row comments and executable gate are correct; the summary sentence is stale.

- **[MINOR-2] The diary's standalone-commit count is stale** (`docs/workstreams/002-implementation-spine/diary/w1.md:143-147`). It says “All four commits” although the first pass lists five commits, and the final W1 history contains nineteen scoped commits including the response documentation. Independent archive verification succeeded for all nineteen; the artifact should not understate what was checked.

## Prior findings — independent closure audit

All eighteen prior findings were rechecked rather than inherited from the response diary:

- **Original Majors 1–6:** `setShuffle`/`setRepeat` exist on the contract and all implementations and are observable through playback; the relationship reader has one closed object parameter; fixture maps spend `LocalKey`; signed-out and free-tier states throw distinct tags; Track Save changes library membership without aliasing Love; every Promise-returning stub method rejects asynchronously. Runtime probe: `NotAuthorized`, `PlaybackNotPermitted`, Save `41 → 42`, shuffle `songs`, repeat `all`, stub search returns a Promise and does not throw at the call site.
- **Original Minors 7–18:** the 2000ms tolerance is literal-gated; all seven brand proofs become unused when the brand is removed; Apple counts/copy are corrected; the B04 roster excludes the two false-but-working capabilities; every documentary absence is `LIKELY`; malformed cursors reject; JSON `null` is tagged; every interface member has substantive TSDoc; subscriptions throw and the two getter deviations are logged; ProviderId has a literal membership gate; relationship evidence changes the diagnosis.
- **Capability matrix:** 25 members exactly; no `ratingStars`, no `offline`; Apple `stationSeedFromTrack: true`; rows 7/10/11/18 remain `LIKELY · docs`; Apple lyrics rows remain `VERIFIED · live` and false; every Spotify false row is `LIKELY · docs`; unsupported copy is non-empty and surfaced only where a control is actually missing.
- **LocalKey:** the package's album/playlist maps are `LocalKeyed`; raw catalog, library and Spotify identifiers do not typecheck in their key positions; removing the brand produced seven confirmed `TS2578` errors.

## Gates and probes run independently

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/providers/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/providers` | exit 0 |
| `bun test packages/providers` | **388 pass, 0 fail**, 1689 expects |
| `bun run typecheck` | **11/11 projects clean** |
| `bun run lint` | exit 0, repo-wide |
| `bun test` | **651 pass, 0 fail**, 2575 expects |
| `bun run gates` | **exit 1 — not implemented** |
| `git archive` + package tsc/tests for all nineteen W1 commits | every commit green; tests grow 59 → 388 |
| trailer grep over all nineteen W1 commits | zero `Co-Authored-By`, `Claude-Session`, generated-with or signed-off trailers |
| changed-path audit over all nineteen W1 commits | only `packages/providers/**` and W1 diary/decisions/evidence paths |
| `provider.id` branch, network, credential, naming and type-escape greps | no implementation violation |

## Mutation results from a byte-isolated scratch archive

Each mutation first asserted its edit with `rg`; none touched the working tree.

| Mutation | Proof it landed | Gate result |
|---|---|---|
| add optional `status` to `RelationshipRead` | exact new member found | provider tsc exit 2 |
| remove the `LocalKey` brand | exact plain alias found | seven `TS2578` unused directives |
| make stub `search()` synchronous | exact non-`async` signature found | `stub.test.ts` exit 1 |
| relabel Spotify row 17 false as `VERIFIED · docs` | exact label found | `evidence-labels.test.ts` exit 1 |

## Gates that remain owner-only

- **U14 / H-5:** requires a phone in a hand and is not applicable to a data-only package; this review does not clear it for the consuming UI.
- **Both-colourway aesthetic call / H-6:** W1 renders nothing; this review does not clear it for W3/W6.

## Working-tree discipline

No implementation file was edited, staged, reset or committed. `git diff -- packages/providers` is empty and `git status --short packages/providers` is empty. The only review output is this appended section in `reviews/w1-review.md`.

---

# Re-review — fixes `b561ecc`, `9f7f16d`, `fd6d294`

**Review date:** 2026-08-28  
**Reviewed tip:** `90b2349` (the three W1 fixes plus later foreign W4/W5a commits)  
**Verdict: REQUEST_CHANGES — 2 Major, 0 Minor**

The three commits close the prior search, album/playlist membership, playlist-count,
documentation, and Apple-provenance findings. Their focused regression tests are
real: independently restoring each old defect makes the relevant test fail. W1 is
still not approvable because one adjacent library slice now contradicts the repaired
search semantics, and the binding full-workstream gate is still red.

## Findings

### Major

- **[MAJOR-1] The same library reports two different answers for artist membership**
  (`packages/providers/src/fixture/fixture-provider.ts:342-350`, `:362-367`,
  `:472-488`). Library-scoped search correctly derives artists from the tracks and
  albums that remain in the user's library via `libraryArtistKeys()`. The
  `libraryList("artists")` branch bypasses that function and returns
  `catalog.artists` unconditionally. I removed every track and album belonging to
  The Fray, then queried both public methods: `search({scope:"library",
  kinds:["artist"]})` excluded The Fray while `libraryList("artists")` still
  returned it. All 400 provider tests remained green because the new membership
  tests cover albums and playlists but not the sibling artist slice. **Why it
  matters:** S04 can say an artist is in the user's library while S12 says the same
  artist is not. That is an internally contradictory fixture, and it repeats the
  exact prior failure class—one provider fact was repaired without checking the
  sibling read path. The resumable fix is bounded: make the artists library slice
  consume the same membership derivation as library search, add a test that removes
  every track and album for one artist and checks both APIs agree, and verify the
  restoration path as well. Audit genres/composers while touching this switch;
  either demonstrate why their catalogue-wide behavior is intentionally different
  or align them, rather than silently inheriting the same discrepancy.

- **[MAJOR-2] The binding `bun run gates` condition is still unsatisfied**
  (`docs/workstreams/002-implementation-spine/scope.md:87-92`,
  `docs/workstreams/002-implementation-spine/evidence/w1-gates.txt:71-92`,
  `scripts/gates.ts:5-9`). W5a has correctly replaced the placeholder, so the old
  “gate does not exist” defect is closed. The actual command still exits 1. On the
  review run, TYPES and LINT passed; TESTS failed because Bun collected the active
  W3 Playwright file (`packages/panel/e2e/panel.spec.ts`) and rejected its
  `test.beforeAll`; static failures were foreign comment/name matches in W3/W4/W6
  surfaces. Running `runStaticGates()` independently showed the W1-relevant
  PROVIDER, TOOLS, TRAILERS, and CREDENTIALS gates passing with no findings, and no
  current static finding points into `packages/providers`. **Why it matters:** the
  W1 implementation is not responsible for those foreign failures, and the fixer
  must not edit around them, but §DoD says every slice needs the full command to
  return zero findings. Approval before that happens would waive a binding owner
  condition that this review cannot waive. Resolution belongs to the active W5a
  and foreign lanes: once their files settle, rerun the full command and append an
  exit-0 artifact. Until then this is a dependency/process blocker, not a request
  for the W1 fixer to modify W3/W4/W5a code.

## Prior final-review findings

| Prior finding | Re-review result |
|---|---|
| Search ignored `scope` and `cursor` | **Closed.** Scope changes the source; cursor advances one cross-kind page; invalid/out-of-range values reject. Runtime: removed track hidden only in library, pages `0..10` and `10..20` have distinct first keys. |
| Album/playlist library writes were dishonest | **Closed for the accepted ref kinds.** Album membership changes albums without changing songs; playlist membership is independent and idempotent. Runtime: albums `4→3`, songs unchanged; playlists `2→1→2`. |
| Playlist `trackCount` stayed stale | **Closed.** Both add and remove replace the published ref. Runtime: listed count 7 equals playable queue count 7. |
| Decision artifact endorsed runtime arity | **Closed.** `decisions/w1.md` and `diary/w1.md` explicitly mark that mechanism superseded and document the closed one-parameter object plus compile-time exact-key/tuple guards. |
| Apple live-provenance summary stale | **Closed and gated.** Header says three live rows and a test asserts the exact three. |
| Diary commit count stale | **Closed.** It now distinguishes five first-pass commits and nineteen through the first response. |
| Full static gate absent/red | **Partially resolved.** Harness now exists; full binding command remains red as Major 2 above. |

## Independent verification

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/providers/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/providers` | exit 0 |
| `bun test packages/providers` | **400 pass, 0 fail** |
| `bun run typecheck` | **11/11 clean** |
| `bun run lint` | exit 0 repo-wide |
| `bun test` | **697 pass, 1 foreign error** — active W3 Playwright spec collected by Bun |
| `bun run gates` | **exit 1**; W1-local PROVIDER/TOOLS/TRAILERS/CREDENTIALS clear |
| standalone archive at `b561ecc` | tsc clean; **399 pass** |
| standalone archive at `9f7f16d` | tsc clean; **400 pass** |
| standalone archive at `fd6d294` | tsc clean; **400 pass** |
| commit trailers and touched paths | no trailers; each commit is coherently scoped to provider or W1 bookkeeping files |

## Mutations rerun independently

Every mutation was made in a fresh `git archive` scratch copy and asserted with
`rg` before testing; none touched the shared tree.

| Restored defect | Result |
|---|---|
| force library search through catalogue source | 2 focused failures |
| reset every search cursor to offset 0 | 2 focused failures |
| restore album writes to track membership | 2 focused failures |
| remove both playlist-ref count updates | 1 focused failure |

The earlier structural mutations were also rechecked through the current suite:
adding a `status` member to `RelationshipRead` is a provider type error; removing
the `LocalKey` brand produces seven unused `@ts-expect-error` directives; making
stub `search()` synchronous fails the failure-protocol test; and relabelling a
Spotify false row `VERIFIED · docs` fails the evidence-label gate.

## Working-tree discipline

No implementation or foreign-lane file was edited, staged, reset, or committed.
`packages/providers` is byte-clean. This appended review section is the only output
of the re-review; the pre-existing shared W3/W4/W6 changes remain untouched.

---

# Narrow re-review — artist membership (`c05054b`, `f72f3fd`)

**Review date:** 2026-08-29  
**Verdict: REQUEST_CHANGES — W1 code clean; only the shared gate Major remains**

## Scoped finding disposition

- **Artist list-vs-search membership Major: CLOSED.** The artists branch of
  `libraryList()` now filters through the same `libraryArtistKeys()` derivation
  used by library-scoped search
  (`packages/providers/src/fixture/fixture-provider.ts:342-350`, `:362-367`,
  `:505-513`). Independent runtime measurement produced the same answer from
  both APIs in all four states: initially present; absent after every matching
  track and album was removed; present after restoring one track; present after
  removing that track and restoring one album. The committed test exercises
  those exact transitions (`fixture-provider.test.ts:471-508`). The adjacent
  genre/composer audit requested by the prior finding was resolved explicitly:
  the catalogue now records album-to-facet keys and library facets derive from
  saved albums or saved tracks (`catalog.ts:161-168`, `:183-184`, `:242-249`;
  `fixture-provider.ts:352-379`, test at `:510-550`). No W1 code finding remains.

- **Shared full-gate Major: OPEN, foreign to W1.** The binding condition remains
  `bun run gates` with zero findings (`scope.md:87-92`). Early in this review the
  current W5a harness ran and remained red only on foreign lint/static surfaces;
  TYPES, TESTS, PROVIDER, TOOLS, TRAILERS, and CREDENTIALS passed. While the
  review was running, the active W5a repair deleted `scripts/gate-core.ts`; the
  final current-state rerun now exits 1 immediately with `Cannot find module
  './gate-core.ts' from 'scripts/gates.ts'`. `git status --short scripts` confirms
  `D scripts/gate-core.ts`. This is not a W1 regression and the W1 fixer must not
  repair or work around it, but a reviewer cannot issue full APPROVE until the
  binding shared command is restored and exits 0. **This is the only remaining
  blocker.**

## Independent checks

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/providers/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/providers` | exit 0 |
| `bun test packages/providers` | **402 pass, 0 fail**, 1735 expects |
| standalone `c05054b` | tsc, scoped lint, **402 tests** all green |
| standalone `f72f3fd` | tsc, scoped lint, **402 tests** all green |
| commit trailers | none on either commit |
| final `bun run gates` | **exit 1**, missing active-W5a `scripts/gate-core.ts` |

## Deterministic mutation proof

All three mutations were made in independent `git archive c05054b` copies and
asserted before the focused test ran:

| Mutation | Result |
|---|---|
| restore `libraryList("artists")` to unconditional `catalog.artists` | focused membership test fails at the post-removal list assertion |
| remove saved tracks from `libraryArtistKeys()` derivation | focused test fails at track restoration |
| remove saved albums from `libraryArtistKeys()` derivation | focused test fails at album restoration |

Each mutation produced exactly one focused failure. The test therefore protects
the original contradiction and both independent restoration paths; it is not a
tautology derived from the implementation's own set.

## Working-tree discipline

No implementation, W5a, or foreign-lane file was edited, staged, reset, or
committed. `packages/providers` remains byte-clean. Only this review artifact was
appended.

---

# Final W1 provider confirmation — W5a `dc8d734`

**Review date:** 2026-08-29  
**Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor**

The final W1 implementation is clean. The provider fixes through `c05054b` and
`f72f3fd` remain byte-unchanged since the prior narrow pass; its three deterministic
artist-membership mutations already prove the original contradiction and both
restoration paths. Re-reading the current provider package, latest W1 evidence,
and the independent W5a approval found no remaining provider finding.

Independent current checks:

- `bunx tsc --noEmit -p packages/providers/tsconfig.json` — exit 0.
- `bunx --bun eslint packages/providers` — exit 0.
- `bun test packages/providers` — **402 pass, 0 fail**, 1735 assertions.
- `bun run gates -- --static-only` — **13 automated pass, 0 fail**; U14/U15
  remain correctly manual. No W4 exclusion was needed for the static predicates.
- Full `bun run gates` — TYPES, TESTS (**827 pass**), all thirteen static gates,
  and every provider/tool/credential/trailer gate pass. Its sole red item is repo
  LINT at the actively modified W4 file
  `apps/web/src/routes/[_]spike.device.tsx:350`; scoped rerun excluding exactly
  `**/*spike.device.tsx` passes. This is the owner-authorized foreign-file
  exclusion for this narrow confirmation, not a W1 waiver.
- Canonical dependency grounding was rechecked under
  `/Users/vinicius/code/agentic-context/effect`: Effect remains
  `4.0.0-rc.112`, `Context.Service` and `effect/unstable/http` are the current
  documented surfaces, and W1 correctly keeps Effect out of this browser-side
  Promise contract.

W5a's final review at `dc8d734` is independently **APPROVE** with all 48 gate
tests green and all thirteen static predicates validated. The former shared-gate
Major is therefore closed for W1: the gate implementation is approved, its static
surface is green on the current tree, and the only aggregate red is the explicitly
isolated active W4 lint edit.

No implementation or foreign file was edited, staged, reset, or committed.
`packages/providers` remains byte-clean; only this review artifact was appended.
