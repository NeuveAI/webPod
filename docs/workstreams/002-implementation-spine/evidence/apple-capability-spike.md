**Row 10 — Apple Music's public API almost certainly cannot remove a track from a library playlist: Apple staff have said so on the record across six years and the sole track-write endpoint appends "to the end" — `LIKELY · docs`, downgraded from `VERIFIED` because the inference rule that carried half its weight has since been falsified. It does not block 002; it does block S17 and the staged-diff work in a later workstream, and it makes `pod-edit-playlist`'s `remove` and `reorder` fields unimplementable on the launch provider.**

# Apple Music capability spike — S1 (revision 3)

Revision 3 is a correction, not a polish pass. **A live probe run against the real API falsified this document's central inference rule and one of its headline findings.** Four labels move down, one row flips to supported, and the claim I was most confident about — that Apple publishes no lyrics endpoint — was wrong.

Applies rulings **D-022** (two-axis labels), **D-023** (`ratingStars`), **D-019** (offline cut repo-wide), and the lead's rulings on the live results.

---

## ⚠ Read this first: the inference rule this document was built on is unsound

Revisions 1 and 2 leaned on a rule stated openly in the method note:

> *"Where I write `VERIFIED` on a negative, the evidence is an **exhaustive enumeration of a documented surface**."*

Put plainly: **"Apple documents no endpoint for X" was treated as entailing "no endpoint for X exists."** That entailment is now **known to be false on this API.**

The empirical probe built an existence oracle out of the relationship *path* form, which returns four distinguishable outcomes where the query form silently ignores garbage:

| Outcome | Meaning |
|---|---|
| `200` | relationship exists, has data |
| `404` · `40403` · *"No related resources found for X"* | **relationship exists**, no data for this resource |
| `400` · `40012` · *"'X' entities require permissions…"* | **relationship exists**, permission-gated |
| `400` · `40008` · *"No relationship found matching 'X'"* | **not a relationship at all** |

Run against `Songs`, it found **three relationships live that are absent from the "exactly seven" documented set I relied on** — `lyrics`, `syllable-lyrics` and `credits`. Negative controls (`similar-songs`, `radio`, `videos`, and a nonsense string) all returned `40008`, so the oracle discriminates rather than saying "exists" to everything.

**Apple's documented surface is strictly smaller than its real surface.** `credits` sharpens it further: it is not permission-gated — it returned `40403`, recognised-but-empty — so the gap is not merely "private entitled endpoints are hidden from the docs." **Ordinary relationships are missing from the documentation too.**

### The counterexample was already sitting in this document, and I did not recognise it

Row 18's sub-finding — written in revision 1, before any live probe — records that Apple's shipped `musickit.js` contains `splice`, `updateItems`, `removeQueueItems` and a deprecated `remove`, **none of which appear in the published v3 reference.** That is a counterexample to the enumeration rule, found by me, recorded by me, labelled correctly, and then **not generalised.** I treated it as a local curiosity about one class instead of evidence about how completely Apple documents anything. The probe slice found the same shape with better controls and drew the general conclusion.

### What moves, and what does not

| | Effect |
|---|---|
| **Rows 10, 11, 18, 7** | `VERIFIED · docs` → **`LIKELY · docs`.** The enumeration leg is falsified. **The second leg is untouched** — six years of explicit, on-the-record Apple staff statements, plus the affirmative *"Add new tracks to the **end** of a library playlist"* phrasing — which is why they stay `LIKELY` and not lower. |
| **`supports()` values** | **None of them move.** All four were already `false`, and a capability is absent until proven present. This is a change in stated confidence, not behaviour. |
| **Why it still matters** | Someone re-opening `pod-edit-playlist` later on the strength of *"we verified this"* would be relying on a claim that no longer holds at that strength. |
| **Row 21a** | **Falsified outright. See row 21.** |
| **Row 30** | Held at **`VERIFIED · docs`** — its enumeration leg is weakened too, but its surviving leg is **structural** rather than **testimonial**, which is what earns it a grade the others cannot have. See the principle immediately below. |

**The general rule going forward: an absence in Apple's documentation is `LIKELY` at best, never `VERIFIED`.** Only an affirmative Apple statement or a live observation earns `VERIFIED`.

### Why rows 10/11/18/7 and row 30 land on different labels — structural vs testimonial evidence

All five rows lost the same enumeration leg, and all five have a surviving affirmative leg. They do **not** land on the same grade, and the reason is a property of the surviving evidence, not a matter of anyone's ruling:

| | Rows 10 / 11 / 18 / 7 | Row 30 |
|---|---|---|
| **Surviving leg** | **Testimonial** — Apple staff stating, in 2019/2020/2022/2025, what the API does | **Structural** — offline audio is EME/Widevine-gated; playback requires a DRM licence, and offline would require a `persistent-license` session Apple's licence server does not issue |
| **How it fails** | **Silently.** The world changes and the statement does not. A 2020 forum reply stays on the page unchanged the day Apple ships the endpoint. | **Visibly.** A mechanism cannot go stale without the mechanism changing — and a change of that size (unprotected assets, or persistent licences) could not happen quietly. |
| **Grade earned** | **`LIKELY · docs`** | **`VERIFIED · docs`** |

**A statement about a system ages; a property of the system does not.** That is the whole distinction, and it is why row 30 keeps a grade its siblings cannot — not because it was ruled on, but because DRM gating is a mechanism we can point at rather than a report we are trusting.

**Neither is `live`, and neither is settled.**

---

## How to read this document

**Method.** Revisions 1–2 were docs-only under H-2 (no Apple Developer account, no signed token). **This revision incorporates live results obtained by a separate slice**, clearly attributed and labelled `live`. **I still made no authenticated API call myself**, and no finding of mine rests on one.

Doc evidence is Apple's published documentation read through the DocC JSON behind `developer.apple.com`, plus the MusicKit-on-the-Web v3 reference at `https://js-cdn.music.apple.com/musickit/v3/docs/` (where `https://developer.apple.com/musickit/web/` sends you, **302**).

### Labels — two axes, per D-022

| Axis | Values | Answers |
|---|---|---|
| **Evidential strength** | `VERIFIED` · `LIKELY` · `UNVERIFIED` | How good is the evidence? |
| **Provenance** | `docs` · `live` | Demonstrated against the running API, or read? |

**`docs` provenance is NEVER "settled". Only `live` closes a row.** This revision is the clearest possible demonstration of why that axis exists: **every wrong finding in revisions 1 and 2 was `docs`, and every one of them was corrected by `live`.** My method was applied honestly and my reviewer re-fetched every source independently — and we were both reading the same incomplete surface. No amount of care on the `docs` axis substitutes for one call.

**Apple Developer Forums replies are corroboration, never the basis of a label.** Third-party repos are capped at `LIKELY` and named.

---

## Row 10 — Can the Apple Music API REMOVE tracks from a library playlist?

**Question.** Can a browser client remove a track from a user's Apple Music library playlist through the public Apple Music API?

**Finding. Almost certainly not — but this is no longer a `VERIFIED` negative.**

**Leg 1 — affirmative Apple statements (untouched, and now the load-bearing leg).** Apple staff, on the record, over six years:

> "Only the ability to add items to the Cloud Library and editable playlists is currently available in the Apple Music API."
> — Apple staff, Feb 2019, https://developer.apple.com/forums/thread/107807

> "…the update is that Apple Music API only allows adding to the cloud library Cloud Library and editable playlists at this time. We are still aware that developers using Apple Music API would like the ability to work with the library in additional including deleting tracks from the user's library."
> — Apple staff, Dec 2020, same thread

Still true at the most recent public exchange found, **October 2025**: a developer asked "How do I DELETE tracks from the playlist? The documentation does not mention a method for this"; Apple's DTS Engineer replied only by pointing at `canEdit`, offered **no deletion method**, and the thread closed unresolved. https://developer.apple.com/forums/thread/805461

Apple's Playlists overview describes the surface positively:

> **"Get the contents of playlists, add new playlists to the user's library, and add tracks to an existing playlist."**
> — https://developer.apple.com/documentation/applemusicapi/playlists-api

And the one track-write endpoint is documented as positionally append-only:

> **"Add new tracks to the end of a library playlist."**
> — https://developer.apple.com/documentation/applemusicapi/add-tracks-to-a-library-playlist

**Leg 2 — the endpoint enumeration (now falsified as a *proof*, retained as *context*).** The Playlists API has one mutation topic group, "Creating and Modifying User Playlists", holding five entries — three endpoints (`POST` playlist, `POST` tracks, `POST` library) and two request objects. Across the whole API there are **nine** `DELETE` endpoints, all ratings. **This is still true and still suggestive. It is no longer proof**, because the documented surface is now known to be a subset of the real one.

**Label: `LIKELY · docs`** (downgraded from `VERIFIED · docs`). **Not settled.**

**What would settle it, and why nobody has.** A live write probe: create a scratch playlist, add tracks, attempt `DELETE /v1/me/library/playlists/{id}/tracks`, read the error code — and crucially, distinguish `40008`-style "no such route" from `40012`-style "exists, not permitted", exactly as the lyrics finding did. **This needs a Music User Token**, which requires an interactive MusicKit `authorize()` browser sign-in; a developer token alone cannot do it, and the read-only probe deliberately never obtained one. **This is the single highest-value unrun experiment in the workstream**, and after the lyrics result it is materially more likely to be informative than it looked.

**The Swift MusicKit red herring, retained.** `MusicLibrary.edit(_:name:description:authorDisplayName:items:)` does remove tracks:

> **"Edits a playlist that your app has created including items to rebuild the list of entries."** … **"This function will throw an error if your app attempts to edit a playlist that another app created."**
> — https://developer.apple.com/documentation/musickit/musiclibrary/edit(_:name:description:authordisplayname:items:)

Availability **iOS 16.0, iPadOS 16.0, tvOS 16.0, visionOS 1.0, watchOS 9.0** — no web, no macOS. Apple's engineer, Jun 2022: *"this functionality is currently only available on Apple platforms"*, and in follow-up *"You cannot edit playlists created via Apple Music API."* Two independent blocks — wrong platform, wrong provenance. https://developer.apple.com/forums/thread/707759

---

## Row 11 — Can it REORDER tracks in a library playlist?

**Finding. Almost certainly not, and it remains a harder "no" than row 10** — reordering needs a positional write or a full-list replace, and neither is documented in any form.

- The only playlist-tracks request body is `LibraryPlaylistTracksRequest` — *"A request to add tracks to a library playlist"*, one property, *"A list of dictionaries with information about the tracks to add."* No position, index, `insert_before` or `range_start`.
- The insertion point is fixed by the endpoint's own abstract: *"to the end of a library playlist."* **This is affirmative and survives the falsified rule.**
- Apple staff, Feb 2022, on `DELETE`/`PUT`: *"all I can say is that we have heard the request."*

**Label: `LIKELY · docs`** (downgraded). **Not settled.** Same settling probe as row 10, same user-token blocker.

**No workaround.** Reorder-by-rebuild needs removal, which row 10 says is unavailable.

---

## Row 18 — Does MusicKit JS v3's queue object support arbitrary splice / remove / reorder?

**Finding — the documented v3 surface exposes no arbitrary remove, no insert-at-index, and no reorder.** The `Queue` class is documented as seven properties and zero methods: `currentItem`, `isEmpty`, `items`, `length`, `nextPlayableItem`, `position`, `previousPlayableItem`.

Queue mutation happens through MusicKit-instance methods:

| Operation | Documented v3 API | Verdict |
|---|---|---|
| Replace whole queue | `setQueue(QueueOptions)` | supported |
| Append | `playLater` — *"Inserts the MediaItem(s)… after the last MediaItem in the current queue."* | supported |
| Insert next | `playNext` | supported |
| Clear | `clearQueue` | supported |
| Jump to index | `changeToMediaAtIndex` / `playAt` | supported |
| **Remove one arbitrary item** | — | **absent from the docs** |
| **Insert at arbitrary index** | — | **absent from the docs** |
| **Reorder / move** | — | **absent from the docs** |

**Label: `LIKELY · docs`** (downgraded). **Not settled.**

**This row's downgrade is the best-earned of the four**, because its own sub-finding is a live counterexample to the rule that was carrying it.

### Sub-finding — undocumented runtime methods. Still do not build on them.

Apple's shipped `musickit.js` v3 (614,791 bytes) contains a `Queue` class with methods **absent from the reference**: `splice(start, deleteCount, items = [])`, `append`, `updateItems`, `removeQueueItems`, `indexForItem`, `item`, `clearAfterCurrent`, `clear` — and `remove(index)`, explicitly self-deprecating:

```js
remove(e){ if(deprecationWarning("remove",{message:"The queue remove function has been deprecated"}),
            e===this.position) throw new MKError(MKError.Reason.INVALID_ARGUMENTS);
           this.splice(e,1) }
```

`splice` publishes `queueModified` and `queueItemsDidChange`. **There is no `reorder` or `move` at any level.**

**Label: `LIKELY · docs`.** Apple's shipped code is a real primary source, but this is minified implementation, one method is explicitly deprecated, and none of it is contractual.

**`supports("queueRemove")` and `supports("queueReorder")` stay `false`** — 001 §14.4's "never invent parity"; Apple deprecating its own undocumented method; no reorder primitive at all.

---

## Row 20 — Is there a public API for starting a station SEEDED FROM A SPECIFIC TRACK?

## **SUPPORTED. `VERIFIED · live`. `supports("stationSeedFromTrack")` flips `false` → `true` — the only value that moves in this document's matrix.**

A song's `station` relationship **is** seeded from that specific song. Measured across three artists × two songs each, plus the artist-station control:

| Artist | Song (id) | Station id | Station name |
|---|---|---|---|
| Fleetwood Mac | The Chain (`651880159`) | **`ra.651880159`** | The Chain Station |
| Fleetwood Mac | Rhiannon (`202271847`) | **`ra.202271847`** | Rhiannon Station |
| Fleetwood Mac | *artist `158038`* | `ra.158038` | Fleetwood Mac & Similar Artists Station |
| Kendrick Lamar | HUMBLE. (`1440882165`) | **`ra.1440882165`** | HUMBLE. Station |
| Kendrick Lamar | Not Like Us (`1781353929`) | **`ra.1781353929`** | Not Like Us Station |
| Kendrick Lamar | *artist `368183298`* | `ra.368183298` | Kendrick Lamar & Similar Artists Station |
| Björk | Human Behaviour (`300205497`) | **`ra.300205497`** | Human Behaviour Station |
| Björk | Army of Me (`300205685`) | **`ra.300205685`** | Army of Me Station |
| Björk | *artist `295015`* | `ra.295015` | Björk & Similar Artists Station |

**Three independent measurements agree**, and the strongest is structural rather than correlational: **the station id is `ra.` + the song's own catalog id, every time.** The identifier is *derived from the seed track* — that is not open to interpretation. Two songs by the *same* artist return different stations in all three cases, killing the artist-station hypothesis. And the artist's own `station` relationship is a visibly different resource under a different naming convention.

The two-call path **song → its station → `setQueue({station})`** is demonstrated end to end at the data layer: `playParams.kind` is `"radioStation"` and `id` is the `ra.*` value `setQueue({station})` accepts.

> **On my original experiment.** Revision 1 specified three songs by three *different* artists, with the failure condition *"if the same artist's songs all return one identical id."* That fixture could not produce that observation, and its success condition was not diagnostic either — both hypotheses predict distinct ids when the artists differ. **Run as I specified it, it would have returned the right answer for the wrong reason.** The probe slice rebuilt it with the within-artist comparison and the artist-station control, and that design is what makes this `VERIFIED` rather than suggestive. I named `Artists.station` as the reason to doubt and then failed to measure it; measured, it is the reason to be confident.

**Implementation hazard, from the same probe.** A typo'd `include`/`extend`/`views` query parameter **fails silently with a `200`** and a response simply missing the relationship — no error, no warning. Any adapter using `?include=station` must assert the relationship is present rather than trusting the status code. **This belongs in the Apple adapter's tests.**

---

## Row 21 — Is there a lyrics endpoint? What entitlement does third-party DISPLAY require? Are lyrics time-synced?

### 21a — Is there a lyrics endpoint? **Yes. `VERIFIED · live`.**

> ### ⚠ Revisions 1 and 2 said no. That was wrong, and 001 §14.3 row 21 was right.
>
> I claimed *"no public lyrics endpoint exists"* at `VERIFIED` strength, and framed it as a correction of 001. **It was 001 that was correct.** The correction is withdrawn in full, and the `⚠` placed on 001 §14.3 row 21 on my evidence should come off. My reasoning was not careless — the reviewer independently re-checked it four ways and found the same zero hits I did. **The documentation is incomplete, and reading it perfectly still produced a wrong answer.**

The endpoint exists and is permission-gated. Against the same song (`651880159`), with a developer token:

| # | Request | Status | Body |
|---|---|---|---|
| 1 | `…/songs/651880159/artists` *(known-good control)* | **`200`** | `{"data":[{"id":"158038","type":"artists",…}]}` |
| 2 | `…/songs/651880159/zzz-not-a-relationship` *(nonsense control)* | **`400`** | `"title":"Invalid Path Value","detail":"No relationship found matching 'zzz-not-a-relationship'","code":"40008"` |
| 3 | **`…/songs/651880159/lyrics`** | **`400`** | `"title":"Insufficient Permissions","detail":"'lyrics' entities require permissions that are not in the request","code":"40012"` |
| 4 | `…/songs/651880159/syllable-lyrics` | **`400`** | `"title":"Insufficient Permissions","detail":"'syllable-lyrics' entities require permissions that are not in the request","code":"40012"` |

**The controls are the whole finding.** Both #2 and #3 are `400`, so the status code alone would have been worthless. Apple's server distinguishes them by title and code: `40008` means *the name is not a relationship*; `40012` means *the name IS a relationship and you lack permission*. **`/lyrics` lands in the second category — Apple's own routing layer recognises `lyrics` as a real entity on `Songs`.**

The third-party reports (`MusanovaKit` and others) were **accurate about existence**. That does not make them safe to build on.

**What this does NOT establish.** "Permissions" is ambiguous between at least two readings, and nothing in the response distinguishes them:

- **(a)** the request lacks a `Media-User-Token` — any authenticated subscriber could read it; or
- **(b)** the *developer token* must carry a privileged entitlement ordinary MusicKit keys do not have.

Testing (a) needs a user token, which was outside the probe's boundary. **And even a `200` under (a) would not answer the question that actually matters**, which is 21b.

### 21b — What entitlement does third-party display require? **`UNVERIFIED · docs`, and this is the real blocker.**

Unchanged. Whether a third party may lawfully *display* Apple Music lyrics is a **licensing question, not an API question.** No status code resolves it.

**What changed is the ask.** Revisions 1–2 pointed at nothing actionable — *"there is no endpoint; do not schedule engineering."* The question is now concrete and answerable by Apple DTS:

> **"`lyrics` and `syllable-lyrics` return `40012 Insufficient Permissions` to our developer token. What entitlement grants that permission, and is it available to us?"**

**Recommend raising it.** It is the only path that can move this row.

### 21c — Are lyrics time-synced? **Three propositions, three labels — they must not be collapsed.**

| Proposition | Label | Basis |
|---|---|---|
| A `syllable-lyrics` **entity exists** | **`VERIFIED · live`** | the `40012` observation proves it exactly as firmly as it proves `lyrics` |
| It is **syllable-*timed*** | **`LIKELY · docs`** | reading the name — inference, not observation |
| Its **content format** | **`UNVERIFIED`** | no response body has ever been seen |

`syllable-lyrics` is confirmed a real, gated entity, and syllable-level timing is the only sensible reading of the name. **No response body has ever been seen**, so the content format stays `UNVERIFIED`. Moot while 21b is unresolved.

### Row 21 product outcome — unchanged

**`supports("lyrics")` and `supports("lyricsSynced")` stay `false`.** A capability gated behind an entitlement we do not hold is not a capability (§14.4). **S16 and the four→three centre-cycle are unchanged.** Do not soften the UI on the strength of this finding.

**Do not build against the endpoint.** `40012` is Apple explicitly declining the request. Routing around it is an entitlement violation, not a workaround.

**What must change is the *reason* recorded in the matrix**, from "no public endpoint" to "exists, `40012`, entitlement unresolved" — a stale comment would have someone re-derive my wrong conclusion.

---

## Row 30 — Is offline audio (download-for-offline) available to a browser client at all?

**Finding. No documented path exists on either half of the stack.**

- **MusicKit v3 reference:** zero occurrences of `offline`, `persist`, `cache`. Four of `download` — all the CSS class `icon-downloadcircle`, not API. No asset accessor, no download method, no persistence API.
- **Apple Music API:** no downloads endpoint. `Songs.Attributes.previews` exposes only *"The preview assets for the song"* — 30-second clips.
- **Playback is DRM-gated. This is the affirmative leg and it is what now carries the row:**
  > **"A notification for indicating that media playback has fallen back to preview mode due to an inability to configure DRM for the current item in the current environment."**
  > — `drmUnsupported`, *Reference › JavaScript › Events*

  The error index includes `WIDEVINE_CDM_EXPIRED`. `previewOnly` is documented as the only non-DRM path: *"playback is restricted to non-DRM preview assets, which are snippets of the full media."*

**Label: `VERIFIED · docs` — on structural evidence, with a flagged residual.**

**Stated honestly: this row's enumeration leg is weakened by the same falsification as rows 10/11/18/7.** "MusicKit documents no download API" no longer proves one cannot exist — and row 18's own sub-finding proves the MusicKit *runtime* carries undocumented surface. What still carries the row is **structural and affirmative**: offline EME playback requires a `persistent-license` `MediaKeySession`, which requires Apple's license server to issue persistent licenses, and Apple documents its web playback as DRM-gated streaming with previews as the only unprotected asset. Corroborating, `LIKELY · docs`: the shipped runtime hardcodes `createFieldFn("offline",()=>!1)` — MusicKit on the Web always reports `offline: false` to Apple's own analytics.

**I am flagging, not moving, this label** — and the reason it holds a grade rows 10/11/18/7 cannot is the structural-vs-testimonial distinction above: **DRM gating is a mechanism, not a report.** It cannot quietly stop being true the way a 2020 forum reply can. **But it is still `docs` and still not settled**, and if anyone wants to close it, it needs a live check, not another read.

---

## Bonus finding (outside the six rows)

**001 §14.3 row 7 — library remove on Apple.** Revision 1 upgraded it to `VERIFIED`; it now sits at **`LIKELY · docs`** alongside rows 10/11/18, same falsified leg, same untouched staff-statement leg (Dec 2020 names *"deleting tracks from the user's library"* explicitly as unavailable). §14.3's posture — **(c) hide on Apple** — is unchanged, and `libraryRemove` stays `false`.

**Its consequence stands: see `pod-add-to-library` below.**

---

# CONSEQUENCES

Everything here is provisional under D-022 except row 20, which is `live`.

## Rows 10 + 11 — playlist remove and reorder unimplementable on the launch provider

| Surface | Change |
|---|---|
| **`pod-edit-playlist`** (§7.2) | Registers on Apple with **`remove` and `reorder` absent from its `inputSchema`**, plus a `description` stating it can only add (§14.6 schema narrowing). |
| **S08 staged diff** (§8.5) | Shows **`+` rows only.** Build the additive-only variant as its natural shape. |
| **Drag handles** | **Do not render** on any Apple playlist surface. Hide, never grey (§14.4). |
| **Undo / the Engraving (B07)** | A playlist add is **not undoable on Apple**. The `⟲` affordance must not render on Apple playlist-add entries. |
| **B04 / S27 `unsupportedReason()`** | Suggested, in §11.0 voice: `Apple Music only lets other apps add to a playlist.` |

**Accuracy note retained from revision 2:** `Remove from Playlist` **does not exist anywhere in 001** — revision 1 invented a control in order to delete it. §4.3's action sheet is `(Play Next, Play Last, Add to Library, Start Station, Share, Show Lyrics, Go to Album, Go to Artist)`; the single "Remove from" hit is `Remove from Library` at `pm-spec.md:2074`, governed by row 7.

## Row 18 — queue remove, reorder and insert-at-index unavailable

| Surface | Change |
|---|---|
| **S17 Up Next** | Drag handles and swipe-to-remove **do not render on Apple either**. Read-only Up Next with append, clear and jump-to-index on **both** providers. |
| **D02 Sidecar · Up Next** (`pm-spec.md:155`) | Its stated purpose is **"Drag to reorder"** and its spec is *"drag handles; source chips per row."* Unachievable on Apple. **D02 needs a new stated purpose before it is designed** — read-only full-queue visibility with source provenance. |
| **`pod-queue-reorder`** | **Not registered on Apple.** Unregistered on both providers. |
| **`pod-queue-insert`** (`:774`) | `position: "index"` and the `index` parameter have no documented implementation on Apple, so the enum narrows to `(next, end)` — **`LIKELY · docs`**, on the same weakened leg as row 18, and the undocumented `splice(start, deleteCount, items)` is precisely an insert-at-arbitrary-index. **`displacedCount`: `UNVERIFIED · docs` — the term is undefined in 001 and the two available readings have opposite consequences. See immediately below. Do not treat either REVIEW trigger as resolved.** |
| **`pod-queue-clear`** | **Still registers on Apple** — `clearQueue` is documented. |

### ⚠ `displacedCount` is undefined in 001 — resolve the term before relying on either REVIEW trigger

**`UNVERIFIED · docs`. I am not picking a reading, and revision 2's flat assertion that it "can only ever be 0" is withdrawn.**

`displacedCount` occurs **twice in all of 001, both on `pm-spec.md:774`** — once in the return shape `{ inserted, queueLength, displacedCount, undoToken }` and once in the gate *`REVIEW` if `> 10` items or `displacedCount > 3`*. **Neither is a definition.** Two readings are available and they are opposite:

| Reading | What it counts | Consequence on Apple |
|---|---|---|
| **(a) items removed or overwritten** | an insert that destroys queue entries | `playNext`/`playLater` destroy nothing → `displacedCount` is always **0**, and the `> 3` trigger **never fires** |
| **(b) items pushed to a later index** | an insert that shifts what follows | `playNext` of 4 items into a 20-item queue pushes 19 back → `displacedCount = 19`, and the trigger **fires constantly** |

**The same cell argues for (b).** 001 justifies the sibling threshold with: *"The `> 10 items` threshold exists because a 60-track insert **is** a queue rewrite even when it is **technically additive**."* That is 001 reasoning explicitly about the harm of *additive* operations — and a displacement gate built on that logic counts items pushed, not items destroyed. Under reading (a) the gate is also dead on **Spotify** (§14.3 row 17 gives it no insert-next, row 18 no reorder), which would mean 001 specified a REVIEW trigger that can never fire on **either** provider. Possible; improbable.

**Why this is not a footnote.** It is an **agent-safety control**, not a UI detail. Under reading (a), declaring the `> 3` trigger dead retires half the staged-REVIEW net for agent queue inserts on the launch provider, leaving the `> 10` item count carrying the whole load — an agent could `playNext` ten tracks, displace an entire queue, and never cross a REVIEW gate. **Wrong in the dangerous direction**, so the honest label is the conservative one.

**It was also the last claim in this document still resting on the falsified inference rule** — "MusicKit documents no insert-at-arbitrary-index" — with the counterexample, `splice(start, deleteCount, items = [])`, sitting in this document's own row 18 sub-finding. That is the D14 pattern one more time, in the one place I had not swept.

**Escalated, not decided.** Defining `displacedCount` is a **001 ambiguity and a PM call**, the same treatment `offline` (D7) and `ratingStars` (D10) correctly received: *an observation, not a decision I was entitled to make.* **Whoever builds the WebMCP surface must resolve the term before relying on either trigger, and must not cite this document as grounds for relaxing the `> 3` gate.**


## Row 20 — **`Start Station` returns to Apple** ✅

**This reverses revision 2.** Row 20 is supported on live evidence:

| Surface | Change |
|---|---|
| **§4.3 action sheet** | **`Start Station` stays, with its track seed working on Apple.** Revision 2 narrowed it to artist/genre/station seeds; that narrowing is withdrawn. |
| **`pod-start-station`** (`:781`) | Registers on Apple with its **full `seedType: enum(track,artist,genre,station)`** — no schema narrowing. **All four seeds are evidenced, not assumed:** `track` is `VERIFIED · live` (above); `artist` — `Artists.Relationships` documents `station`, *"The station associated with the artist. By default, station not included. Fetch limits: None (one station)"*; `genre` — `StationGenres` exists with a stations relationship and a documented *Get All Station Genres* endpoint; `station` — carried by the documented `setQueue({station:'ra.*'})`. |
| **S18 Radio** | **Gains the track-seeded station row**, alongside catalog, live and personal stations. |
| **Spotify** | Unchanged — stays absent per §14.3 row 20 unless separately settled. |
| **Adapter** | Resolve via `GET /v1/catalog/{sf}/songs/{id}/station`, then `setQueue({station: 'ra.<songId>'})`. **Assert the relationship is present** — a typo'd `include` returns `200` with the relationship silently missing. |

## Row 21 — lyrics: product outcome unchanged, reason changed

| Surface | Change |
|---|---|
| **S16 Lyrics** (`:117`) and **D04 Sidecar · Lyrics** (`:157`) | **Cut, or an honest empty state, on both providers** — unchanged. The reason is now *"not entitled"*, not *"does not exist"*. Suggested copy shifts accordingly: `Apple Music doesn't make lyrics available to other apps.` |
| **§4.3 centre-button cycle** (`:274`) | `Volume → Scrub → Rate → Lyrics → Volume` **drops to three stops** — unchanged. |
| **§5.1 row 3** (`:544`) | *"Time-synced lyrics as the **fourth stop**… plus a full-width sidecar surface on desktop (D04)."* Still unbuildable; cut or re-scope. |
| **§4.3 action sheet** (`:275`) | `Show Lyrics` still goes. |
| **§4.4 rotate** (`:268`), **§4.6 keyboard** (`:403`), **§11.6 empty state** (`:1699`), **§12 open question 4** (`:1767`) | All still dead with S16. |
| **`pod-get-lyrics`** (`:782`) | **Still not registered on any provider.** Consider deleting from the §7.2 roster — PM call, flagged not taken. |
| **`hasLyrics`** | Still do not surface it. A flag saying "lyrics exist and you can't see them" is the disabled-control anti-pattern §14.4 forbids — **and it is now literally true rather than figuratively.** |
| **New: the DTS ask** | Raise the `40012` entitlement question with Apple. It is the only thing that can move this row, and it costs one support ticket. |

**Corrections retained from revision 2:** §10.1 and §11.8 do **not** contain the centre cycle. **§15.1's S13 DoD item 4 needs no edit** — it is already conditional on `supports("lyrics")`.

## Row 30 — offline audio unavailable · full blast radius

Offline is **cut repo-wide** (D-019). **§5.1 row 10 is *partly invalidated*, not confirmed** — revision 1 wrongly called it "correct and settled". Its three clauses are a per-row download glyph, a `Downloaded only` filter, **and** a Service Worker cache; the first two are killed, only the third survives.

**Counts, reproducible.** In `pm-spec.md`: `grep -c 'download'` → **25 lines**; case-insensitive → **30**; **45 total occurrences**; `⤓` on **2 lines**.

| § | Line | What it promises | Kind of change |
|---|---|---|---|
| §5.1 row 10 | 551 | download glyph per row; `Downloaded only` filter *(Service Worker clause survives)* | **design cut, partial** |
| §7.2 `pod-search` | 758 | returns `downloaded` per item — **a field nothing can populate** | **tool-schema change** |
| §7.3 | 807 | "library-and-**downloaded** tools remain" while `DISCONNECTED` | registration-matrix edit |
| §8.5 | 1120 | `Sign out` — "downloads stop" | copy |
| §9 J6a | 1334, 1336, 1337 | `214 downloaded songs still play` · `Play downloads` · scope auto-switch to `Downloaded only` | **journey path cut** |
| §9 J6b | 1344, 1345, 1348 | "Downloaded audio continues" · `Downloads keep playing.` · "Full browse of downloads" | **journey path cut** |
| §9 J6c | 1356 | `Reload` · `Play downloads` | **journey path cut** |
| §10.1 S13 | 1384 | `214 downloaded songs still play.` / `Play downloads` | per-screen Offline row |
| §10.2 S03 | 1400 | **`Downloads` row inserted at position 2** and lit | per-screen Offline row |
| §10.3 D01 | 1416 | `Offline — showing downloads.`; D05 filters to downloaded | per-screen Offline row |
| §10.5 S25 | 1449 | `Offline — I can only work with your downloads.` | per-screen Offline row |
| §10.6 S08 | 1465 | **`⤓` glyph**; `4 of 12 downloaded` | per-screen Offline row |
| §10.7 S12 | 1481, 1482 | `Search downloads`; scope locks to `Downloaded only` | per-screen Error + Offline rows |
| §10.8 S17 | 1498 | `9 of 15 will play offline` | per-screen Offline row |
| §11.0 | 1521 | voice example `214 downloaded songs still play.` | copy |
| §11.2 | 1551 | button label `Play downloads` | copy |
| §11.3 | 1599 | agent voice `Offline — I can only work with your downloads.` | copy |
| §11.4 | 1629 | B08 confirm `Downloads stop playing. Your library stays in your account.` | copy |
| §11.5 | 1672, 1673, 1675, 1679, 1682 | five error/interruption strings promising downloads | copy |
| §11.8 | 1749 | **accessibility string** `Sign out of Apple Music? Downloads stop playing.` | **a11y copy** |
| §14.3 row 30 | 1945 | the row itself | resolved |

**Seven per-screen `Offline` rows in §10** — S13, S03, D01, S25, S08, S12, S17. **Not five screens**, which was 001's own untested estimate that revision 1 repeated as fact.

**Survives:** the Service Worker cache of shell, artwork and metadata. `DISCONNECTED` becomes **browse-cached-metadata-only**. **Nothing renders a greyed or broken download affordance** — absent, not disabled (U15).

## Row 7 (bonus) — `pod-add-to-library`'s undo is a control that cannot work

§7.2's `pod-add-to-library` (`:765`) carries `UNDO` and actuates *"a 20px in-raster footer row reads `Added to your library.  ⟲ Undo` for 30s."* **An undo of a library add is a library remove**, which row 7 says is unavailable.

**Change:** the `⟲ Undo` footer does not render on Apple. The tool keeps `RW` but loses `UNDO` on the launch provider; the footer reads `Added to your library.` with no affordance. The `alreadyPresent: true` no-op path is unaffected.

---

## ⚠ Adapter hazard — Apple returns `200` for an invalid `include` / `views` / `extend`

**This is for whoever builds the Apple provider adapter, and it is a correctness trap, not a style note.**

Apple's Music API is **strict on relationship *paths* and lax on relationship *query parameters*.** Measured live:

| Request | Status | Result |
|---|---|---|
| `GET /v1/catalog/us/songs/651880159?include=zzz-bogus` | **`200`** | full song resource — **no error, no warning** |
| `GET /v1/catalog/us/songs/651880159?views=zzz-bogus` | **`200`** | full song resource — no error, no warning |
| `GET /v1/catalog/us/songs/651880159?extend=zzz-bogus` | **`200`** | full song resource — no error, no warning |
| `GET /v1/catalog/us/zzz-bogus-resources/651880159` | `400` | `40008` *"Unknown catalog resource type"* — paths **do** validate |

**A typo'd `?include=station` returns a success code and a response that is simply missing the relationship.** Nothing surfaces the mistake: no error, no warning, no differing status. A bug of this shape looks exactly like "this song has no station" and would be read as a data condition rather than a client defect — and on row 20 that would silently disable the one capability this spike just confirmed.

**The rule for the adapter: assert the relationship is *present in the payload*. Never infer it from the status code.** Every `include`/`extend`/`views` consumer needs a presence check and a distinct error path for "requested but absent", separate from "absent because empty". This belongs in the adapter's tests as a named case, not as an incidental assertion.

Corollary: the strict *path* form is the reliable one, and it is what makes the existence oracle at the top of this document work at all. Where correctness matters more than round-trips, prefer `GET …/songs/{id}/station` over `?include=station`.

---

## Apple `supports()` matrix — ready to paste

**A capability is absent until proven present.** One value is `live`; the rest are `docs` and provisional.

```ts
// Apple Music capability matrix.
// Derived from the Apple Music API reference, the MusicKit on the Web v3
// reference, and one read-only live probe run with a developer token.
// Provenance is per-line. `docs` values are provisional and NOT settled:
// Apple's documented surface is known to be smaller than its real surface.
const APPLE_SUPPORTS: Record<Capability, boolean> = {
  // ── FALSE ───────────────────────────────────────────────────────────────
  playlistRemoveTracks:  false, // LIKELY·docs — no documented endpoint + Apple
                                // staff on record 2019/2020/2025. Unprobed:
                                // needs a user token and a real mutation.
  playlistReorder:       false, // LIKELY·docs — no positional write documented
  queueRemove:           false, // LIKELY·docs — undocumented + self-deprecated only
  queueReorder:          false, // LIKELY·docs — no such method at any level
  libraryRemove:         false, // LIKELY·docs — no documented endpoint, AND Apple
                                // staff Dec 2020 naming library deletion outright:
                                // developers want "deleting tracks from the user's
                                // library" and the API "only allows adding".
                                // Unprobed: needs a user token and a real mutation.
  lyrics:                false, // VERIFIED·live — the endpoint EXISTS; returns
                                // 400 / 40012 "Insufficient Permissions" to our
                                // developer token. NOT "no endpoint". Gated behind
                                // an entitlement we do not hold; display licensing
                                // (21b) unresolved. Do not route around 40012.
  lyricsSynced:          false, // VERIFIED·live — `syllable-lyrics` exists, same
                                // 40012; response body never seen.

  // ── TRUE ────────────────────────────────────────────────────────────────
  stationSeedFromTrack:  true,  // VERIFIED·live — station id is `ra.<songId>`;
                                // distinct per song within one artist; a different
                                // resource from artists/{id}/station.
  playlistCreate:        true,  // POST /v1/me/library/playlists
  playlistAddTracks:     true,  // POST …/{id}/tracks — appends to END only
  libraryAdd:            true,  // POST /v1/me/library
  queueAppend:           true,  // MusicKit v3 playLater()
  queueInsertNext:       true,  // MusicKit v3 playNext()
  queueRead:             true,  // MusicKit v3 Queue.items / .position / .length
  stations:              true,  // setQueue({station:'ra.*'}) — catalog/personal/live

  // ── Not examined here; carried from the 001 parity table unchanged ──────
  auth: true, search: true, libraryRead: true,
  transport: true, seek: true, volume: true,
  ratingLoveDislike: true, saveToggle: true,
  progressTicks: true, artworkArbitrarySize: true,
};
```

**Four notes for whoever wires this up.**

1. **`ratingStars` is absent by ruling (D-023)**, not by oversight. §14.2 omits stars from `MusicProvider` on purpose; they are a local-only device rating emulated on both providers. A `supports()` key implies a provider question and there is none.
2. **The union in `packages/providers` has 25 members, not §14.2's 26 — this is settled, not open (D-026).** `ratingStars` is **dropped from the union outright** in our copy, so a plain `Record<Capability, boolean>` compiles again. Revision 2's `Record<Exclude<Capability, "ratingStars">, boolean>` was an interim for an implementer who could not change the union; D-026 replaced it, because `Exclude<>` propagates the awkwardness into every consumer's type — and against a 25-member union it is a silent no-op that reads as deliberate. **Do not go looking for a 001 amendment: 001 is read-only, which is exactly why the drop is scoped to `packages/providers` and recorded as a deviation.** Anyone diffing our union against §14.2 will find exactly one missing member, by design.
3. **`offline` is not a union member and, per D-019, will not become one.** Row 30 has no key **by decision**.
4. **`playlistAddTracks: true` carries a positional constraint `supports()` cannot express.** Apple appends to the end, always. Anywhere the UI or a tool implies an insertion point, it will be wrong on Apple.

---

## What is still unrun, ranked

1. **The playlist write probe (rows 10, 11).** Create a scratch playlist, add, attempt `DELETE`, **read the error code and distinguish `40008` from `40012`** exactly as the lyrics probe did. Needs a **Music User Token** via an interactive `authorize()` sign-in. **Highest value in the workstream** — it is the launch provider's highest-risk row, and the lyrics result shows this API answers the question when asked properly.
2. **The `40012` entitlement question to Apple DTS (21b).** Costs one support ticket; the only thing that can move lyrics.
3. **The relationship oracle against other resources.** It works on any `GET` relationship path. `Albums`, `Artists` and `Playlists` have never been swept, and `Songs` alone hid three.
4. **Row 30's persistent-license check.** Lowest value — the structural argument is strong and the answer would not change the product.
