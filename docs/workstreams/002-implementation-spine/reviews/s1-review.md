# Review: S1 — Apple Music capability spike (docs-only)

## Verdict: REQUEST_CHANGES

Four Major findings. None of them is a fabricated capability, and none of them is an inflated
`VERIFIED-docs` in the sense the dispatch feared — **I fetched Apple's documentation myself for all
six rows and every quote in the deliverable is verbatim and every enumeration I could check is
either exact or off by a countable, non-load-bearing amount.** The research is genuinely good and
the row 21 correction against 001 is *correct*, which I verified four different ways.

The failures are on the other side of the document: the **labels conflict with a recorded HITL
decision**, and the **CONSEQUENCES section — the half that tells an implementer what to change —
is materially incomplete and in two places states things about 001 that are not true.** A spike
whose research is right and whose consequences are wrong is still a spike that will be built from
wrongly, and D-019 already shows one of these errors propagating into a settled owner decision.

---

### Findings

#### [MAJOR] Five rows carry `VERIFIED-docs` where H-2 and 001 §15.3 #14 say they stay `UNVERIFIED-docs-only`

`evidence/apple-capability-spike.md:3, :44, :93, :128, :191, :209, :228, :240`

`hitl-decisions.md:32` (H-2, `Defaulted`, owner answer 2026-08-28) records:

> the six `UNVERIFIED` §14.3 rows … are resolved from Apple's published API documentation only,
> **and the finding stays labelled `UNVERIFIED-docs-only`.**

`review-system-prompt.md:47` restates it as a reject-on-sight item:

> **An `UNVERIFIED` row treated as a fact.** … **See H-2: they are `UNVERIFIED-docs-only` and stay
> that way.**

The deliverable labels rows 10, 11, 18 (documented surface), 21a and 30 — plus the bonus row 7 —
`VERIFIED-docs`. `review-system-prompt.md:13-21` ranks `hitl-decisions.md` **above** the lane
dispatch in the binding-contract order and says a decision recorded there is "a requirement to
enforce, not a topic to reopen."

I am not ruling that the author was wrong to reason this way. The **S1 dispatch itself**
(`dispatch/S1-apple-capability-spike.md:19-22`) defines a three-value vocabulary that includes
`VERIFIED-docs` and tells the reviewer to check that each one "carries a quotable source" — so the
dispatch plainly contemplates the label being used, and `decisions/s1.md:7-17` (D1) argues the case
honestly and in the open. **The two contracts disagree, and only the lead can rule.** Until they do,
the practical damage is real and already visible:

- `decision-log.md:121-134` (D-015) now carries these rows as settled findings.
- The §15.3 #14 tripwire — the single most important guardrail on this lane — is disarmed. A future
  reader who greps for `UNVERIFIED` on rows 10/11/18/21/30 finds nothing.
- D-018 exists *because* the lead does not consider the enumeration argument equivalent to a
  demonstration (`decision-log.md:161`: "Converts rows 10, 11 and 18 from an enumeration argument
  into a demonstration"). That is H-2's position, not the deliverable's.

**Fix, cheap either way:** append the `-docs-only` qualifier to the five negative rows (
`VERIFIED-docs-only`), *or* the lead amends H-2 and records in the decision log that
`dispatch/S1`'s vocabulary supersedes it. Do one. Do not leave two binding documents saying
different things about the same six rows.

#### [MAJOR] `ratingStars: false` in the paste-ready matrix contradicts 001 §14.3 row 22 and §5.1 row 13, and was never examined by this spike

`evidence/apple-capability-spike.md:317`

```ts
ratingStars:           false, // row 22 · not a provider capability; local-only (§14.3)
```

It sits inside the block headed `── Resolved FALSE by this spike ──` (`:308`). **S1 did not
examine row 22.** Row 22 was not in the six, and unlike row 7 — which the author correctly quarantined
in a labelled "Bonus finding (outside the six rows)" section per D8 — this one was written straight
into the deliverable with no flag and no decision-log entry.

Worse, the value is wrong for the contract it is being pasted into:

- `pm-spec.md:1855` — `supports()` is "**THE contract. Every UI branch, and every WebMCP
  registration, reads this.**"
- `pm-spec.md:1937` (§14.3 row 22) — "**(a) emulate, local-only, both providers.** Stars become a
  **device rating**: stored in IndexedDB, **shown on S15**".
- `pm-spec.md:554` (§5.1 row 13) — "Star ratings **kept** (S15)".
- `pm-spec.md:768` (§7.2) — `pod-rate-track` takes `stars?: number` (0–5) and actuates "**S15 Rate
  mode** … dots fill one at a time at 60ms intervals".

`ratingStars: false` + §14.4's hide-don't-grey rule + §14.6's schema-narrowing rule = S15's stars are
hidden and `pod-rate-track` loses its `stars` field on Apple. That deletes a designed, `VERIFIED`,
both-provider feature.

This is exactly the ambiguity the author *did* flag correctly for `offline` in D7
(`decisions/s1.md:84-88`: "Observation, not a decision I was entitled to make … Escalated to the
lead, unresolved"). The same treatment was owed here and was not given. Either remove the row from
the matrix entirely as out of S1's scope, or flag it as D7 was flagged — a local-only emulated
capability has no obvious `supports()` value and that is a PM call, not a spike call.

#### [MAJOR] The row 30 consequences under-enumerate the blast radius by a wide margin, and affirmatively endorse a §5.1 design its own finding kills

`evidence/apple-capability-spike.md:234, :287-295`

Line 234:

> **001 §5.1 row 10's existing assumption — a Service Worker cache of shell, artwork and metadata,
> never audio — is correct and should be treated as settled.**

`pm-spec.md:551` (§5.1 row 10) does not say that. It says:

> Explicit **Downloaded** state: **a download glyph per row, a "Downloaded only" filter** that
> survives the offline transition, **and** a Service Worker holding the shell, the art cache, and
> the last 200 rows of every visited list.

The Service Worker clause is one third of the row. The other two thirds — the per-row download glyph
and the `Downloaded only` filter — are **killed** by this spike's own row 30 finding. Telling the
lead that §5.1 row 10 "is correct and should be treated as settled" is affirmatively wrong, and it
propagated: `decision-log.md:167-173` (D-019, owner, settled) simultaneously cuts §5.1 row 10 *and*
repeats the spike's claim that "this was already 001's stated assumption (§5.1 row 10)".

The consequences table then names four surfaces (`J6b`, the `⤓` glyph, `DISCONNECTED`, "§11.5 and
§11.6"). I grepped `download` across `pm-spec.md`: **25 hits**. Not named, and each one promises
offline audio the platform cannot supply (001 §15.3 #10, "rendering a fact the platform never
supplies"):

| Location | What it promises |
|---|---|
| `pm-spec.md:758` (§7.2 `pod-search`) | Returns `downloaded` per item — a field nothing can populate |
| `pm-spec.md:807` (§7.3) | "library-and-**downloaded** tools remain" while `DISCONNECTED` |
| `pm-spec.md:1120` (§8.5) | `Sign out` — "downloads stop" |
| `pm-spec.md:1334-1356` (§9 J6a/J6b/J6c) | `214 downloaded songs still play` · `Downloads keep playing.` · `Play downloads` ×3 |
| `pm-spec.md:1384, 1400, 1416, 1449, 1465, 1482, 1498` | **Seven** per-screen `Offline` rows in §10 — S13, S03, D01, S25, S08, S12, S17 — each promising downloaded playback (`Downloads` row inserted at position 2; `Downloaded rows lit with a ⤓`; `9 of 15 will play offline`; `4 of 12 downloaded`) |
| `pm-spec.md:1551, 1599, 1629, 1749` | §11.2 button label, §11.3 agent voice, §11.4 B08 confirm, **§11.8 accessibility string** `Downloads stop playing.` |

The deliverable also repeats 001's own unchecked estimate — "**copy on five screens** … is now due"
(`:294`) — without testing it. §10 alone carries **seven** affected screen states before the copy
deck is opened. Carrying an unverified figure forward as a fact is the failure mode this lane exists
to prevent.

#### [MAJOR] The consequences omit three §7.2 surfaces that this spike's own findings partially invalidate on Apple

`evidence/apple-capability-spike.md:238-240, :263-272, :274-276`

§14.6's "**Partially supported → the schema narrows**" rule is invoked correctly for
`pod-edit-playlist` (`:254`) and then not applied to three tools it equally governs:

1. **`pod-queue-insert`** (`pm-spec.md:774`) — `position?: enum(next,end,index)`, `index?: number`,
   returns `displacedCount`, and escalates to `REVIEW` when `displacedCount > 3`. The spike's own
   row 18 table (`:116-125`) establishes that MusicKit v3 documents `playNext`, `playLater`,
   `setQueue` and `changeToMediaAtIndex` and **no insert-at-arbitrary-index**. So `position: "index"`,
   `index` and the whole `displacedCount` gate are unimplementable on Apple through documented API.
   The tool is not mentioned anywhere in the consequences.
2. **`pod-start-station`** (`pm-spec.md:781`) — `seedType: enum(track,artist,genre,station)`. The
   matrix sets `stationSeedFromTrack: false` (`:313`), which under §14.6 forces `track` out of that
   enum on Apple. Instead the row 20 consequences open with "**No surface changes *yet*, and none
   should be planned on it**" (`:276`) and then, in the same paragraph, change a surface
   (`Start Station` stays out of the action sheet). Both cannot be true, and the tool schema is
   named in neither.
3. **`pod-add-to-library`** (`pm-spec.md:765`) — carries `UNDO` and actuates "a 20px in-raster footer
   row reads `Added to your library.  ⟲ Undo` for 30s". The spike's *own* bonus finding (`:240`)
   upgrades `libraryRemove` on Apple to not-supported-`VERIFIED-docs`. **An undo of a library add is
   a library remove.** The author spotted this exact problem for playlist add (`:257`, "A playlist
   add is **not undoable on Apple**") and missed the identical, more explicitly-specified case one
   section later. §7.2's `⟲ Undo` footer here is a control that cannot work — 001 §15.3 #10.

Also missed: **D02 Sidecar · Up Next** (`pm-spec.md:155`), whose stated purpose is "Drag to reorder"
and whose spec is "Full sidecar height; **drag handles**; source chips per row". The row 18
consequences name S17 only.

---

#### [MINOR] "the ten ratings deletions" — there are nine

`evidence/apple-capability-spike.md:35`; `decisions/s1.md:17`

I walked Apple's full DocC render index for the Apple Music API (608 nodes) and counted the `DELETE`
endpoints: Album, Music Video, Playlist, Song, Station, Library Album, Library Music Video, Library
Playlist, Library Song = **9**. The conclusion is untouched — none of them is playlist membership —
but D1's entire evidentiary claim is *"I enumerated the surface exhaustively"*, and an enumeration
offered as proof has to be countable and correct.

#### [MINOR] "it contains exactly three entries" — the topic group contains five

`evidence/apple-capability-spike.md:29-33`

`Creating and Modifying User Playlists` holds five identifiers: the three endpoints listed, plus
`LibraryPlaylistCreationRequest` and `LibraryPlaylistTracksRequest`. Three *endpoints*, five
entries. Same reason as above: precision is the load-bearing element of a negative finding.

#### [MINOR] `Remove from Playlist` does not exist anywhere in 001

`evidence/apple-capability-spike.md:256`

> The row's action sheet loses its `Remove from Playlist` item entirely on Apple.

`grep -rn "Remove from"` across `pm-spec.md`, `design-system.md`, `readme.md` and `handover.html`
returns exactly one hit — `pm-spec.md:2074`, **`Remove from Library`**, in §15.1's S08 DoD, governed
by §14.3 row **7**, not rows 10/11. §4.3's canonical action sheet is `(Play Next, Play Last, Add to
Library, Start Station, Share, Show Lyrics, Go to Album, Go to Artist)` — no playlist-removal item
has ever existed. The consequences section's one job is to be accurate about 001's contents.

#### [MINOR] Two of the three sections named for the lyrics four→three edit do not contain the cycle

`evidence/apple-capability-spike.md:283`

> §4.3's centre-button cycle spec, S13's state matrix (§10.1), and §11.8's accessibility strings for
> the cycle all need the four→three edit.

- §4.3 (`pm-spec.md:274`) — correct, it is the canonical `Volume → Scrub → Rate → Lyrics → Volume`.
- §10.1 (`pm-spec.md:1377-1391`) — the S13 state matrix does **not** mention the centre cycle at all.
- §11.8 (`pm-spec.md:1732-1755`) — contains **no** cycle strings. It does contain a string this spike
  kills and did not name: `Sign out of Apple Music? Downloads stop playing.` (row 30).

Missed, and they do carry it: **§5.1 row 3** (`pm-spec.md:544`, "Time-synced lyrics as the **fourth
stop** in the Now Playing center-button cycle (S16)"), **§4.3's action sheet** item `Show Lyrics`,
and **§3.1/§3.2's** S16/D04 inventory rows. Conversely §15.1's S13 DoD item 4 (`pm-spec.md:2023`)
is *already* written conditionally — "the cycle is three stops, not four, when `supports("lyrics")`
is false" — and needs no edit at all.

#### [MINOR] The "exhaustive" QueueOptions enumeration omits a selector the same document relies on two rows later

`evidence/apple-capability-spike.md:126` vs `:163`

> `QueueOptions` content selectors are **documented as exactly four type pairs** — `album`/`albums`,
> `musicVideo`/`musicVideos`, `playlist`/`playlists`, `song`/`songs` — plus `url` …

I extracted the QueueOptions tables from Apple's shipped v3 docs bundle and that list is exactly
right **for the `Queue` reference page**. But `station` is a fifth selector, documented by Apple on
the *Playing Catalog / Live / Personal Stations* pages — and the spike itself quotes
`setQueue({ station: 'ra.985496511' })` at `:163` to carry row 20. This is a small hole in a large
method: Apple documents API surface in the guides as well as the reference index, so "the reference
index is exhaustive" is not quite the closed-surface argument D1 claims. It does not damage row 18
(I checked all 19 doc modules for `splice`/`reorder`/`removeQueueItem`/`updateItems`/`insertAt` —
zero, see below), but the claim should be scoped to the page it was read from.

#### [MINOR] The paste-ready block carries the workstream id into `packages/providers`

`evidence/apple-capability-spike.md:304-305`

```ts
// Apple Music — capability matrix. Source: docs/workstreams/002-implementation-spine/
// evidence/apple-capability-spike.md (S1, docs-only, no authenticated call made).
```

`review-system-prompt.md:59` — "**workstream ids absent from implementation artifacts**". This block
is explicitly labelled "ready to paste into `packages/providers`", so as written it leaks
`002-implementation-spine` and `S1` into source on the first paste. Cite the finding, not the
bookkeeping path.

#### [INFO] Two small factual slips in the method note

`evidence/apple-capability-spike.md:9` — `https://developer.apple.com/musickit/web/` returns **302**,
not 301. `:219` — "zero occurrences of … `download`" in the v3 reference: the docs bundle contains
four, all of them the CSS icon-set class `icon-downloadcircle`. The prose claim is true; the literal
one is not.

---

### Suggestions (non-blocking)

- **Row 10 has stronger evidence available than the one used.** The `playlists-api` page's own
  abstract is an affirmative Apple sentence enumerating the entire capability set: *"Get the
  contents of playlists, **add** new playlists to the user's library, and **add** tracks to an
  existing playlist."* That is Apple describing the surface positively and exhaustively, which is
  closer to "states it plainly" than an argument from a missing endpoint. Quote it.
- **H-2 asks for slightly more in the first line than the dispatch does.** `hitl-decisions.md:34`:
  "It **does** block S17 and the staged-diff work in a later workstream, and the spike report must
  say so in its first line." The first line answers row 10 (per the dispatch) but does not name the
  blocking consequence. One clause.
- The row 10 answer is on **line 3**, after the `#` heading. The dispatch says "Line one". Pedantic,
  and I would not block on it, but it is a one-character fix.
- `decision-log.md:167` calls §14.2's `Capability` union "25-strong". It has **26** members. The
  spike's matrix is complete over all 26 — I checked key by key — so this is the lead's slip, not
  the author's, but it should be corrected before someone uses it as a checksum.
- D3 (`decisions/s1.md:35-46`) is the best entry in either file: it finds Apple's shipped code
  contradicting Apple's docs, keeps the headline at not-supported, records the runtime methods as a
  separate `LIKELY`, gives three independent reasons for `supports() = false`, and explicitly
  declines to propose the feature-probe that would flip it. That is the posture this project asks
  for, and it should be the template for the other lanes.

---

### Gates I ran myself — independent verification

Docs-only lane; no typecheck/lint applies. I re-fetched every primary source rather than trusting a
quote, and read Apple's machine-readable doc indexes rather than the rendered pages, so the
enumerations are countable.

**Row 10 / 11 — Apple Music API, the enumeration argument.** This is the claim the dispatch pointed
me at hardest, and **it holds.**

- `curl https://developer.apple.com/tutorials/data/index/applemusicapi` → 200. Walked the full
  render index: **608 nodes**. Regexed every title for `delete|remove|update|replace|reorder|modif|
  edit|patch|put`. Result: nine `Delete a Personal … Rating` endpoints (not ten — see Minor), four
  section titles containing "Modifying", and `EditorialNotes`. **No removal, replacement,
  repositioning or update endpoint exists anywhere in the documented API.** The enumeration is
  genuinely exhaustive; the author did not check one index page and generalise.
- `…/applemusicapi/playlists-api.json` → 200. Six topic sections dumped in full. `Creating and
  Modifying User Playlists` = `Create-a-New-Library-Playlist`, `Add-Tracks-to-a-Library-Playlist`,
  `Add-a-Resource-to-a-Library`, `LibraryPlaylistCreationRequest`, `LibraryPlaylistTracksRequest`.
  **Confirmed additive-only.**
- `…/applemusicapi/add-tracks-to-a-library-playlist.json` → 200. `abstract` is verbatim
  `"Add new tracks to the end of a library playlist."` **Quote is exact.**
- `…/applemusicapi/libraryplaylisttracksrequest.json` → 200. Abstract `"A request to add tracks to a
  library playlist."`; **exactly one property**, `data`, `"A list of dictionaries with information
  about the tracks to add."` **No position/index/insert_before field. Quote is exact.**

**The D2 trap — Swift `MusicLibrary.edit` is a different API surface.** Verified, and the decision
log is right.

- `…/musickit/musiclibrary/edit(_:name:description:authordisplayname:items:).json` → 200. Abstract
  verbatim `"Edits a playlist that your app has created including items to rebuild the list of
  entries."`; `This function will throw an error if your app attempts to edit…` present. Platforms:
  **iOS 16.0, iPadOS 16.0, tvOS 16.0, visionOS 1.0, watchOS 9.0** — no web, and no macOS either.
- Forum thread 707759 fetched: David (Engineer, Apple), Jun '22 — *"Editing playlists does support
  removing tracks from a playlist… By the way, this functionality is currently only available on
  Apple platforms."* and the follow-up *"You cannot edit playlists created via Apple Music API."*
  **Both quotes verbatim, both correctly characterised as a scope mismatch, not a contradiction.**
- Forum thread 107807 fetched: Feb 2019, Dec 2020 and Feb 2022 staff replies **all verbatim**.
- Forum thread 805461 fetched: Oct 2025, developer asks how to `DELETE` tracks, DTS Engineer replies
  only by pointing at `canEdit`, **offers no deletion method**, thread unresolved. Exactly as
  reported.
- **Confirmed the forums are corroboration only.** Every `VERIFIED-docs` label rests on a DocC page
  I fetched; no label rests on a forum reply or a third-party repo. The author's claim at `:21`
  is true row by row.

**Row 18 — MusicKit v3, documented surface.** The hardest one to check, because Apple's v3 reference
is a Storybook SPA. I pulled `iframe.html`, downloaded the preview bundle
(`main.49f36b39.iframe.bundle.js`, 712 KB) and extracted the MDX heading trees directly.

- `Queue` class: **exactly seven `h3` property ids and zero methods** — `currentitem`, `isempty`,
  `items`, `length`, `nextplayableitem`, `position`, `previousplayableitem`. **Matches the
  deliverable exactly.** `items` abstract verbatim `"An array of all the MediaItems in the queue."`,
  type `Array<MediaItem>`.
- MusicKit instance: **exactly the 24 methods listed in the deliverable**, no more, no fewer.
  `playLater` abstract verbatim: *"Inserts the MediaItem(s) defined by QueueOptions after the last
  MediaItem in the current queue."*
- Grepped **all 19 story modules** (essentials, how-to, reference, tech-notes) for
  `splice` = 0, `removeQueueItem` = 0, `updateItems` = 0, `insertAt` = 0, `reorder` = 1 (a SCSS
  mixin), `move` = 6 (all CSS `cursor: move`). **There is no documented queue-mutation method
  anywhere in the v3 docs, guides included.** Row 18's documented-surface finding is sound.

**Row 18 sub-finding — undocumented runtime methods, and whether they leaked into the matrix.**
Downloaded `https://js-cdn.music.apple.com/musickit/v3/musickit.js` (614,791 bytes — the
deliverable's "615 KB" is right). Confirmed present: `splice(` ×15, `removeQueueItems` ×4,
`updateItems` ×1, `clearAfterCurrent` ×2, `indexForItem` ×4. The quoted `remove()` snippet is
**verbatim**, deprecation warning and `INVALID_ARGUMENTS` throw included. **And they were genuinely
kept out:** `queueRemove: false` and `queueReorder: false` at `:311-312`, D3 declines the
feature-probe and flags it to the lead. Nothing in the matrix relies on an undocumented method.

**Row 20 — is `LIKELY` honest?** Yes, and I would not have graded it differently.

- `…/applemusicapi/songs/relationships-data.dictionary.json` → 200. **Exactly seven relationships**,
  including `station`, whose entire text is `"The station associated with the song. By default,
  station is not included. Fetch limits: None"` — **verbatim, and that really is all Apple says.**
- The `setQueue({ station: 'ra.985496511' })` sample is present verbatim in the *Playing Catalog
  Stations* page, alongside live (`ra.1498155548`) and personal (`ra.u-…`) variants, which also
  substantiates `stations: true`.
- Both halves are documented; the *semantics* of "associated" are not. `LIKELY` + `supports() =
  false` is the correct call, and D4's named settling probe (developer token only, three songs,
  three artists, compare `ra.*` ids) is the right experiment. **This is not an
  under-labelled `VERIFIED`, and it is not an over-labelled `UNVERIFIED`.**

**Row 21 — the correction against 001. This is the strong claim, and it is correct.** I attacked it
from four directions and found no lyrics endpoint in any Apple documentation:

| Source | Method | `lyric` hits |
|---|---|---|
| Apple Music API | full render index, 608 nodes | **0** |
| Swift MusicKit | full render index, 1187 nodes | **1** — `var hasLyrics: Bool`, nothing else |
| Apple Music Feed API | full render index | **0** |
| MusicKit on the Web v3 | all 19 doc modules in the preview bundle | **0** |

- `…/applemusicapi/songs/attributes-data.dictionary.json` → 200. **26 attributes**, matching the
  deliverable's list exactly, `hasLyrics` quote verbatim, **no lyrics content field**.
- I also verified the *shape* of the sub-finding: every lyric identifier in `musickit.js`
  (`lyricsPlay`, `lyricsStop`, `LYRIC_DISPLAY`, `lyric-id`, `lyric-language`) sits inside the
  analytics event-name enum and the metrics field schema, gated on
  `event-type === LYRIC_DISPLAY`, reading from a `lyricDescriptor` the SDK never populates. **No
  fetch, no render, no accessor.** The author's reading is exact.

**001 §14.3 row 21's premise that `/v1/catalog/{sf}/songs/{id}/lyrics` "exists" is not supported by
any Apple source I can find. The correction should be accepted and 001 amended.** This is the most
valuable thing in the deliverable and it survives an adversarial check.

**Row 30.** `offline` = 0, `persist` = 0, `cache` = 0 across the whole v3 docs bundle;
`download` = 4, all CSS icon classes. `drmUnsupported` and `WIDEVINE_CDM_EXPIRED` present, quotes
verbatim; the `previewOnly` quote verbatim. `createFieldFn("offline",()=>!1)` present in
`musickit.js`, correctly labelled `LIKELY` as minified implementation. **The finding is right; the
consequences drawn from it are the Major above.**

**Matrix completeness.** Counted §14.2's `Capability` union: **26 members**. The deliverable's
`Record<Capability, boolean>` covers all 26 with no omission and no invented key. Every unresolved
row is `false`, including `stationSeedFromTrack` despite its `LIKELY`. **Rule 7 of my brief —
"every unresolved row must be false" — is satisfied.** The one wrong value, `ratingStars`, is wrong
for the opposite reason (a resolved, emulated capability set to `false`), not for inflation.

**Guardrails.** `git status --porcelain` at review start: the only untracked paths were `cert/` and
`docs/workstreams/002-implementation-spine/` — **no tracked file modified, no 001 document touched,
no source file, no `package.json`.** S1's own outputs are exactly two files,
`evidence/apple-capability-spike.md` and `decisions/s1.md`. I confirmed the `cert/AuthKey_*.p8`
signing key and `scripts/spikes/mint-apple-dev-token.ts` post-date S1 and belong to D-016/D-018 and
the W0/S2 lanes — **they are not S1's**, and nothing in the repo indicates S1 made an authenticated
call, created an account, or used the owner's email. I did not open the key material. **D-006/H-2
compliance is clean, and I did not relitigate the docs-only decision or demand a token call.**

**Two gates I cannot clear, stated explicitly as required.** U14 (thumb occlusion, needs a phone in
a real hand) and the both-colourway aesthetic call are **owner-only, H-5 and H-6**. Neither is
reachable in a docs-only research lane and neither was exercised by this work; I am not passing over
them silently, and I have not approved around them.

---
---

# Re-review — revision 3

**Reviewing `evidence/apple-capability-spike.md` @ 12:51 and `decisions/s1.md` @ 12:53, against rulings D-022, D-023, D-026, D-028, D-029.** The revision-2 pass was cut off mid-flight; this starts from the current files. The two sections above are left intact as the record.

## Verdict: REQUEST_CHANGES

Two Major findings, both carried from work in progress rather than newly introduced, and both in the paste-ready block or its immediate neighbourhood — the part of this document that lands in source.

**Everything the lead asked me to verify, I verified, and revision 3 passes all six.** The greps reproduce to the digit, the consequence citations are real, the adapter hazard is stated operationally, the row-21 matrix comment is right, and **I independently confirmed all nine rows of the row-20 station table against Apple's public web with no token.** The correction work is genuine and the self-analysis in D14 is correct — and it implicates me as much as the author, which I set out below.

---

### Findings

#### [MAJOR] The paste-ready block still carries the `Exclude<>` interim that D-026 superseded, and note 2 misstates where the fix belongs

`evidence/apple-capability-spike.md:397` and note 2 at `:437`

```ts
const APPLE_SUPPORTS: Record<Exclude<Capability, "ratingStars">, boolean> = {
```

> 2. **Live type tension, flagged not resolved.** §14.2's `Capability` union has **26 members and still includes `ratingStars`** … `Exclude<>` keeps this honest and visible. The clean fix is dropping it from the union in 001 — **a 001 amendment, the lead's to record.**

`decision-log.md` **D-026** already recorded it, and did so *before this file was written* — decision log 12:47, deliverable 12:51. Its ruling:

> **Ruling: drop `ratingStars` from the union in `packages/providers`.** 25 members, and a plain `Record<Capability, boolean>` again.
> … the `Exclude<>` workaround **propagates that awkwardness into every consumer's type.**

Two defects, not one:

1. **The construct D-026 explicitly replaced is still what an implementer would paste.** Against a 25-member union with no `ratingStars`, `Exclude<Capability, "ratingStars">` is a silent no-op that reads as deliberate, so nothing surfaces the staleness at compile time.
2. **Note 2 sends the reader to the wrong place.** It says the fix is "a 001 amendment, the lead's to record". D-026 scoped the drop to `packages/providers` *precisely because 001 is read-only*, and flagged it `⚠ DEVIATES` for exactly that reason. A reader following note 2 goes looking for a 001 edit that will never exist and cannot find the ruling that already resolved this.

This is a mechanical sync, not a judgment failure — and the author is the reason D-026 exists, which is to their credit (D-023's own correction block says "raised by S1 revision 2"). But the fix was available for four minutes before the file was written and the deliverable is the artifact that reaches source. `Record<Capability, boolean>`, and note 2 rewritten to cite D-026 as settled.

#### [MAJOR] `displacedCount can only ever be 0` is still asserted flatly, unlabelled — and now contradicts this document's own leading section

`evidence/apple-capability-spike.md:294`

> **`displacedCount` can only ever be 0**, making the `> 3` REVIEW escalation dead code on the launch provider.

No evidential label, no provenance, no alternative reading, no "what would settle it" — in a revision whose opening section establishes that **"an absence in Apple's documentation is `LIKELY` at best, never `VERIFIED`."** Three problems:

**1. `displacedCount` is undefined in 001.** I grepped all of `001-interface-design-handover/`: **two occurrences, both on `pm-spec.md:774`** — once in the returns shape `{ inserted, queueLength, displacedCount, undoToken }` and once in the gate `REVIEW` if `> 10` items or `displacedCount > 3`. Nothing defines it. The claim rests on one reading of an undefined term:

- *Author's reading:* displaced = items **removed or overwritten**. Append and insert-next remove nothing → 0 on Apple.
- *Competing reading:* displaced = items **pushed to a later index**. `playNext` of four items into a twenty-item queue pushes nineteen back → `displacedCount = 19`, and the gate fires constantly on Apple.

**2. The same cell argues for the competing reading.** `pm-spec.md:774` justifies its sibling threshold with: *"The `> 10 items` threshold exists because a 60-track insert **is** a queue rewrite even when it is **technically additive**."* 001 is explicitly reasoning about the harm of *additive* operations. A displacement gate built on that logic counts items pushed, not items destroyed. And under the author's reading the gate is dead on Spotify too — §14.3 row 17 gives Spotify no insert-next and row 18 no reorder — so 001 would have specified a REVIEW trigger that can never fire on **either** provider. Possible; improbable.

**3. It is the one claim in the document still resting on the falsified rule.** "MusicKit documents no insert-at-arbitrary-index" is precisely the inference revision 3 declares unsound at `:11-48` — and the counterexample is forty lines above the claim, at `:147`: `splice(start, deleteCount, items = [])` in Apple's shipped runtime, which inserts at an arbitrary index. The document's own row 18 sub-finding supplies the mechanism by which `displacedCount` could be non-zero.

**Why this is Major rather than Minor:** it is an agent-safety estimate, D-027 records it as such, and it is wrong in the dangerous direction. Declaring the `> 3` trigger dead code retires half the staged-REVIEW net for agent queue inserts on the launch provider, leaving the `> 10` item count carrying the whole load — so an agent could `playNext` ten tracks and displace an entire queue with no REVIEW.

**Fix:** label it, state both readings, and escalate the definition of `displacedCount` to the lead as a 001 ambiguity. That is exactly the treatment the author correctly gave `offline` (D7) and `ratingStars` (D10) — *"an observation, not a decision I was entitled to make."* The same instinct is owed here.

---

#### [MINOR] The full `seedType` enum is restored on live evidence for `track` only; `artist`, `genre` and `station` ride uncited

`evidence/apple-capability-spike.md:304`

> Registers on Apple with its **full `seedType: enum(track,artist,genre,station)`** — no schema narrowing.

`pm-spec.md:781` does carry that enum, and `track` is now `VERIFIED · live`. But the other three seeds are asserted, not evidenced, in a document whose stated rule is that a capability is absent until proven present. They are all fine, and I fetched the sources so the author does not have to:

- `artist` — `Artists.Relationships` documents `station`, *"The station associated with the artist… Fetch limits: None (one station)."*
- `genre` — `StationGenres` exists with `StationGenresStationsRelationship` and `Get All Station Genres`.
- `station` — already carried by `setQueue({station:'ra.*'})`.

Cite them, or narrow. Revision 2 was wrong to narrow away `track`; revision 3 should not overcorrect into an unevidenced widening.

#### [MINOR] Row 21c's headline label attaches the wrong strength to the wrong proposition

`evidence/apple-capability-spike.md:229`

> ### 21c — Are lyrics time-synced? **`LIKELY · live` that a syllable-level variant exists.**

That a `syllable-lyrics` entity **exists** is `VERIFIED · live` — the `40012` observation proves it as firmly as it proves `lyrics`. What is `LIKELY` is that it is *syllable-timed*, and that rests on reading the name, which is `docs`-grade inference, not a live observation. The prose below disentangles this correctly ("confirmed a real, gated entity… the content format stays `UNVERIFIED`"); the headline conflates the two axes D-022 exists to separate. Split it: existence `VERIFIED · live`, timing `LIKELY` on the name, format `UNVERIFIED`.

---

### On D14 — the lead asked for an independent read, and the honest answer implicates me

**D14's reading is correct, and it understates the problem, because it happened twice.**

The author's claim is that revision 1's row-18 sub-finding — undocumented `splice` / `updateItems` / `removeQueueItems` in Apple's shipped runtime — was a counterexample to its own inference rule, found by itself, sitting forty lines from four findings that depended on that rule. I checked the artifact and the reading holds exactly: `:145-160` records Apple's shipped code carrying queue surface absent from Apple's published reference, and `:69-142` rests rows 10, 11 and 18 on the premise that Apple's published reference is a closed enumeration. Same document, same API, opposite premises, unreconciled.

**And I did the same thing, with less excuse.** The lead asked whether I had that evidence in round 1 without spending it. I did:

- I downloaded the same bundle and counted the methods myself — `s1-review.md:335-341`, *"Confirmed present: `splice(` ×15, `removeQueueItems` ×4, `updateItems` ×1…"*
- I then wrote, in my own words, at `s1-review.md:267-268`: **"it finds Apple's shipped code contradicting Apple's docs"** — and used it as *praise*, calling D3 "the best entry in either file."
- Roughly seventy lines earlier I had certified the opposite premise: **"the enumeration is genuinely exhaustive; the author did not check one index page and generalise."**

So I independently re-derived the counterexample, stated it in a single clause, and spent it on a compliance tick — *were the undocumented methods kept out of `supports()`?* — never asking what it implied about the four rows I was in the middle of certifying. My job on that lane was specifically to break the enumeration argument. I had the thing that breaks it, in my hand, in my own sentence.

There is a second-order version worth recording, because it is the same shape at a different altitude. My round-1 Major 1 *did* say the five `VERIFIED` labels were unsafe — but on **contract-conflict** grounds (H-2 versus the dispatch), not on **evidential** grounds. I argued the labels were wrong because two documents disagreed about vocabulary, when the actual reason they were wrong was that the evidence did not support them. **Right remedy, wrong reason** — which is the identical failure D-024 named in S1's row-20 fixture ("the design and the decision rule were not the same experiment") and that D-031 named in the lead's own RISK-02 wording ("the mitigation was right for both reasons; the reasoning named only one"). That is now three instances across three different agents in one workstream. If anything from this slice is worth promoting to standing law, it is D14's check — *after each finding, ask not only what it changes about the product but what it changes about how you are reasoning* — and its corollary that **a finding correctly handled locally can still be evidence you have not spent.**

---

### Gates I ran myself — revision 3

**1. Does the document lead with the falsified inference rule?** **Yes, and it is the right shape.** `:11` — *"⚠ Read this first: the inference rule this document was built on is unsound"* — before the method note and before any row. It contains the four-outcome oracle table (`200` / `40403` / `40012` / `40008`), the three undocumented `Songs` relationships (`lyrics`, `syllable-lyrics`, `credits`), the negative controls and why they matter, an explicit statement of **which leg died** (enumeration) and **which survived** (six years of Apple staff statements plus the affirmative *"to the end"* phrasing), a what-moves table stating that **no `supports()` value changes**, and the self-counterexample at `:32`. The generalised rule is stated plainly: *"an absence in Apple's documentation is `LIKELY` at best, never `VERIFIED`."* Not buried; not four silent relabels.

**2. Row-21 matrix comment.** `:406-412`. Value is **`lyrics: false`** — unchanged, correct. Reason rewritten to *"VERIFIED·live — the endpoint EXISTS; returns 400 / 40012 'Insufficient Permissions' to our developer token. NOT 'no endpoint'. Gated behind an entitlement we do not hold; display licensing (21b) unresolved. **Do not route around 40012.**"* All four required elements present. `lyricsSynced: false` carries the parallel comment. **The trap the lead named — a `false` with a stale reason — is closed.**

**3. Row 20's reversal of revision 2.** Checked against `pm-spec.md:781`, which reads `seedType: enum(track,artist,genre,station)`. Revision 3 keeps the full enum and withdraws revision 2's narrowing, which is correct now that `track` is live-supported. **And I verified the underlying evidence independently, without a token**, by resolving every id in the row-20 table against Apple's public web:

| Id | Public page | Title returned |
|---|---|---|
| `651880159` | `/us/song/…` | The Chain — Song by Fleetwood Mac |
| `ra.651880159` | `/us/station/…` | **The Chain Station** |
| `ra.202271847` | `/us/station/…` | **Rhiannon Station** |
| `ra.1440882165` | `/us/station/…` | **HUMBLE. Station** |
| `ra.1781353929` | `/us/station/…` | **Not Like Us Station** |
| `ra.300205497` | `/us/station/…` | **Human Behaviour Station** |
| `ra.300205685` | `/us/station/…` | **Army of Me Station** |
| `ra.158038` | `/us/station/…` | Fleetwood Mac & Similar Artists Station |
| `ra.368183298` | `/us/station/…` | Kendrick Lamar & Similar Artists Station |
| `ra.295015` | `/us/station/…` | Björk & Similar Artists Station |

All `200`. **The structural claim holds: `ra.` + the song's own catalog id resolves to a station named after that song**, two songs by one artist give two different stations, and the artist station is a visibly different resource under a different naming convention. This is the first row in the workstream I have been able to confirm from a source independent of the slice that produced it.

**4. Adapter hazard — is it operational for W1?** **Yes.** `:366-385`, its own top-level section, with a measured table (`?include=`, `?views=`, `?extend=` bogus values all `200`; a bogus *path* segment `400/40008`) and the rule stated as an instruction, not an observation: **"assert the relationship is *present in the payload*. Never infer it from the status code."** It goes further than the lead asked, requiring a distinct error path for *"requested but absent"* versus *"absent because empty"*, naming it as a required adapter test case, and adding the corollary to prefer the strict path form where correctness beats round-trips. It also connects the hazard to row 20 — a typo'd `?include=station` would silently disable the one capability this spike just confirmed.

**5. Consequence citations — spot-checked, and then checked exhaustively.** The lead asked for three. I did eleven individually — `pm-spec.md:117, 157, 268, 274, 275, 403, 544, 781, 782, 1699, 1767` — and every one says what the deliverable claims. Then I did the row-30 blast-radius table **exhaustively by set comparison**: extracted the line column, diffed it against `grep -in "download" pm-spec.md`. **30 cited, 30 actual, zero in either direction.** The consequences are grep-derived, as claimed. This was revision 1's core methodological failure and it is genuinely repaired, not asserted.

**6. Major-3 greps, re-run.** `grep -c 'download' pm-spec.md` → **25**. Case-insensitive → **30**. `grep -io 'download' | wc -l` → **45**. `grep -c '⤓'` → **2**. **All four reproduce exactly.** Seven per-screen `Offline` rows in §10 — S13, S03, D01, S25, S08, S12, S17 — confirmed against §10's subsection boundaries; B01 correctly excluded, as it carries no download promise.

**What I could not verify, stated rather than glossed.** I cannot reproduce the `40012` / `40008` lyrics oracle. Unauthenticated, `api.music.apple.com` returns **`401` identically** for `…/songs/651880159/artists`, `…/lyrics`, and a nonsense relationship — I ran all three; the discrimination the finding depends on is invisible without a token, and minting one is outside this lane. **I am accepting D-029 and the row-21 retraction on the lead's authority and S2's evidence, not on my own verification, and I flag that rather than implying otherwise.** What I *can* confirm is the negative half: `credits` appears **zero** times across the Apple Music API's 608-node render index, and `Songs` has exactly seven documented relationship nodes and no `Views` nodes at all — so the "documented surface is strictly smaller than the real surface" claim is not overstated. My round-1 enumeration was an accurate description of the documentation. The documentation was the thing that was wrong.

**Row 30's residual.** `:257-261` flags — without moving — that row 30's enumeration leg is weakened by the same falsification, and names what now carries it: the affirmative DRM evidence, `previewOnly`, and the persistent-license argument. That is the correct handling of a label the lead ruled on, and I would have raised it had the author not.

**Guardrails.** `git status --porcelain` shows the deliverable and `decisions/s1.md` as the only S1-owned paths; no 001 file is modified, no source file, no `package.json`. No workstream id or slice id appears anywhere inside the paste-ready block — Minor 6 from round 1 stays fixed. I staged and committed nothing; I wrote this file only.

**The two gates I still cannot clear.** U14 (thumb occlusion) and the both-colourway aesthetic call remain **owner-only, H-5 and H-6**, unreachable in a research lane and not exercised by this work. Stated explicitly rather than passed over, as required.

---

### What is now good enough to say plainly

Revision 3 retracts its own headline finding, withdraws a correction it had put on a primary source, downgrades four labels it had defended, reverses a schema decision from revision 2, and writes the self-analysis in D14 — none of which improves how the slice looks, and all of which improves what the next person can trust. The two Majors above are a stale type construct and one unlabelled sentence. **Fix those two and this approves.**

---
---

# Re-review — revision 4

**Reviewing `evidence/apple-capability-spike.md` @ 13:01 and `decisions/s1.md` @ 13:02, against D-026, D-027, D-038, D-040 and D-041.** Earlier sections left intact as the record.

## Verdict: APPROVE

Both Majors from revision 3 are fixed, both Minors are fixed, and **D-041 is discharged: I ran the oracle myself and it reproduces exactly.** Two Minors below, neither of which moves a `supports()` value, a label the lead has ruled on, or a screen.

---

### D-041 — I reproduced the row-21 oracle independently

This was the one thing in the slice resting on a single measurement, and it is the measurement that overturned a finding two readers had already validated. **It is now measured twice, by two instruments.** I did not re-run `probe-apple.ts`; I imported only `mintDeveloperToken` and issued the GETs myself, so the oracle logic is mine and not a re-execution of the thing under review.

Song `651880159` (The Chain, Fleetwood Mac), developer token, read-only:

| Path | HTTP | Apple's response |
|---|---|---|
| `/artists` *(known-good control)* | **200** | `data[1] type=artists id=158038` |
| `/composers` *(documented)* | **200** | `data[5] type=artists id=186919` |
| `/station` *(documented)* | **200** | `data[1] type=stations id=`**`ra.651880159`** |
| `/library` *(documented)* | **404** | `40403` · *"No related resources found for library"* |
| `/zzz-not-a-relationship` *(nonsense control)* | **400** | `40008` · *"No relationship found matching 'zzz-not-a-relationship'"* |
| **`/lyrics`** | **400** | **`40012`** · *"'lyrics' entities require permissions that are not in the request"* |
| **`/syllable-lyrics`** | **400** | **`40012`** · *"'syllable-lyrics' entities require permissions that are not in the request"* |
| **`/credits`** | **404** | **`40403`** · *"No related resources found for credits"* |
| `/similar-songs` *(negative control)* | **400** | `40008` |
| `/radio` *(negative control)* | **400** | `40008` |
| `/videos` *(negative control)* | **400** | `40008` |

**Every claim holds.**

- **The four-state oracle is real** — `200` / `40403` / `40012` / `40008` are all distinguishable, and Apple's server really does separate *"not a relationship"* from *"a relationship you may not have"*.
- **It discriminates.** All three negative controls return `40008`. It is not saying "exists" to everything, which was the failure mode that would have made the whole finding worthless.
- **`/lyrics` and `/syllable-lyrics` exist.** `40012`, not `40008`. **The row-21 retraction is correct, 001 §14.3 row 21 was right, and my round-1 endorsement of S1's correction was wrong.** The `⚠ DEVIATES` stamp on 001 §14.3 row 21 should come off, as the deliverable says.
- **`credits` is the sharp one and it replicates.** Undocumented *and* ungated — `40403`, recognised-but-empty. So the documentation gap is not the comfortable story that Apple merely hides entitled endpoints. **Ordinary relationships are missing from the docs too**, which is what actually kills the enumeration inference and justifies D-029.
- **Bonus: D-028 re-confirmed at the API layer.** `/station` returns `ra.651880159` — `ra.` + the song's own id, matching the public-web check I ran in round 3 from an entirely different source.

**Discipline.** Read-only throughout: GETs only, nothing under `/v1/me/`, `assertReadOnly()` untouched — I read it rather than assuming it, and it does hard-stop non-GET and `/v1/me/`. Nothing under `cert/` was read, printed or copied; the key reached only `mintDeveloperToken` via `APPLE_MUSICKIT_KEY_PATH`; the token was held in a variable, never written, never logged, JWT-scrubbed on the way out, TTL 300s. No writes were wanted at any point.

---

### Findings

#### [MINOR] Row 30 is held at `VERIFIED · docs` by authority where it needs a principle (D-040)

`evidence/apple-capability-spike.md:261, :265`

> **Label: `VERIFIED · docs`, per the lead's ruling — with a flagged residual.**
> … **I am flagging, not moving, this label** — the lead ruled row 30 unchanged…

The author is right not to move a label the lead ruled on, and the residual flag at `:263` is honest and unprompted. But run D-040's check over it and an asymmetry surfaces that the document notices without naming:

| Row | Enumeration leg | Surviving affirmative leg | Label |
|---|---|---|---|
| 10 / 11 / 18 / 7 | falsified | Apple staff on record 2019–2025; *"to the end"* phrasing | **`LIKELY · docs`** |
| 30 | falsified — *the document says so itself* | DRM gating, `previewOnly`, persistent-license argument | **`VERIFIED · docs`** |

Same structure, same falsification, different label — and the reason offered is *"per the lead's ruling"*, which is an authority citation, not a reason that supports a label. Under **D-038's second question** — does the reason given actually support the conclusion, or merely arrive at the same place — this arrives at the right place by citation.

**A principle does divide them, and it is worth one sentence:** row 30's affirmative leg is **structural** — DRM gating is a *mechanism* that makes offline audio impossible — whereas rows 10/11's is **testimonial**, Apple staff saying a thing is not offered, which can go stale and demonstrably did (the Oct 2025 thread is a non-answer, not a denial). Structural evidence outranks testimony, and that is why row 30 can hold a grade the others cannot. State that, and the asymmetry stops reading as caution applied inconsistently.

#### [MINOR] `libraryRemove`'s matrix comment gives only the falsified leg, where its siblings give both

`evidence/apple-capability-spike.md:431`

```ts
libraryRemove:         false, // LIKELY·docs — no documented endpoint
```

Compare its sibling three lines up:

```ts
playlistRemoveTracks:  false, // LIKELY·docs — no documented endpoint + Apple
                              // staff on record 2019/2020/2025. …
```

Row 7 **has** an affirmative leg, and it is the most explicit one in the document — Apple staff, Dec 2020, naming library deletion by name: *"…including deleting tracks from the user's library."* It is quoted in the prose at the bonus finding and then dropped from the matrix comment, leaving the shipped artifact justifying `libraryRemove: false` on **the bare inference this revision exists to retire**.

This is the same class of defect as D15's — the value is right, the reason is what survives into `packages/providers`, and a reader in a year finds only "no documented endpoint" behind a `LIKELY` and cannot tell whether anything but an absence was ever checked. Add the staff citation, as `playlistRemoveTracks` already does.

*(`playlistReorder` and `queueReorder` carry absence-only comments too, but correctly so — neither has an affirmative leg independent of row 10's, and both say `LIKELY`, which is honest. `libraryRemove` is the one that has evidence and omits it.)*

---

### Gates I ran myself — revision 4

**The paste-ready block.** Parsed the TypeScript object and counted keys programmatically rather than by eye: **`Record<Capability, boolean>`, plain, no `Exclude<>`. 25 keys. Zero duplicates. Zero extras. Exactly one member of §14.2's 26-member union absent — `ratingStars`.** Matches D-026 precisely.

**Note 2.** `:463`. Now reads *"The union in `packages/providers` has 25 members, not §14.2's 26 — **this is settled, not open (D-026)**"*, explains why `Exclude<>` was replaced (propagates awkwardness into every consumer's type; a silent no-op against a 25-member union), and states **"Do not go looking for a 001 amendment: 001 is read-only, which is exactly why the drop is scoped to `packages/providers` and recorded as a deviation."** Both defects from revision 3 are closed, including the misdirection to a nonexistent 001 edit.

**`displacedCount`.** `:300` and its own flagged block at `:303-320`. Labelled **`UNVERIFIED · docs`**; revision 2's flat assertion explicitly withdrawn; both readings tabled with their opposite consequences ((a) never fires / (b) fires constantly); the *"technically additive"* argument for (b) reproduced; the Spotify cross-check present; **no reading picked**; escalated as a 001 ambiguity and a PM call with the D7/D10 formula — *"an observation, not a decision I was entitled to make"*; and the operative instruction is there in terms: **"must not cite this document as grounds for relaxing the `> 3` gate."** I re-verified the underlying fact: `displacedCount` occurs **twice in all of 001, both on `pm-spec.md:774`**, neither a definition.

**`position: "index"` → `LIKELY · docs`, unprompted.** `:300`. Correct, and the reasoning is the right one — it rests on the same weakened leg, and the document names its own counterexample, `splice(start, deleteCount, items)`, as precisely an insert-at-arbitrary-index. This was not asked for; the author found it by running D-040's check on themselves.

**Revision 3's two Minors.** Both fixed. `:330` now evidences all four `seedType` seeds instead of asserting them, and the `artist` and `genre` citations match what I fetched independently in round 3 (`Artists.Relationships.station`; `StationGenres` + *Get All Station Genres*). `:229` splits 21c into **three propositions with three labels** — existence `VERIFIED · live`, timing `LIKELY · docs`, format `UNVERIFIED` — which is a better fix than the one I proposed.

**D-038, question 1 — does any finding contradict the method used for the rest?** Swept revision 4's new text. **No.** The `credits` result is now used to establish the strong form of the doc gap rather than sitting inert; row 18's sub-finding is explicitly generalised in the leading section *and* invoked again inside the `displacedCount` block; every `true` in the matrix rests on positive documentation, which the falsification does not touch. The one claim still resting on the falsified rule in revision 3 — `displacedCount` — is the one that moved.

**D-038, question 2 and D-040 — sweep for authority-in-place-of-reason and inconsistently applied caution.** Two hits, both Minor, both above. Everything else divides on a stated principle: `docs` vs `live`, absence vs affirmative, provider capability vs local emulation.

**Regression checks, re-run rather than assumed.** `grep -c 'download'` → **25**; case-insensitive → **30**; occurrences → **45**; `⤓` → **2**. Row-30 blast-radius table diffed by set comparison against the live grep: **30 cited, 30 actual, zero drift in either direction.** Consequence citations spot-checked again at `pm-spec.md:155, 774, 781` — all correct.

**Git.** I staged nothing, reset nothing, committed nothing, and wrote exactly one file — this review. I can confirm the index state the lead flagged: `git status` shows `MM` on both S1 files, i.e. staged copies plus newer working-tree edits. Left untouched.

**The two gates I still cannot clear.** U14 (thumb occlusion) and the both-colourway aesthetic call remain **owner-only, H-5 and H-6**, unreachable in a research lane and not exercised here. Stated rather than passed over.

---

### Closing note

Across four revisions this document retracted its own headline finding, withdrew a `⚠ DEVIATES` it had caused to be stamped on a primary spec, downgraded four labels it had defended, reversed a schema decision, and wrote D14 against itself. **The last correction — `position: "index"` — was found by the author applying D-040 to their own text without being asked**, which is the point at which a review loop has done its job.

What I would carry forward is narrower than any of that. My round-1 review certified an enumeration argument as sound while quoting, seventy lines away and in my own words, the evidence that broke it. The oracle above took three GETs and five minutes. **The gap between "I re-fetched every source and they all agree" and "I asked the API" was the entire distance between right and wrong on this slice**, and no amount of care on the `docs` axis closes it. That is D-022's provenance axis earning its keep, and it is the reason this lane's remaining `LIKELY · docs` rows — 10, 11, 18 and 7 — should be treated as open until the playlist write probe runs, exactly as the deliverable's own ranked list says.
