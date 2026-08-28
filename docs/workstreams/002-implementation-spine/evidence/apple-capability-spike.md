**Row 10 — Apple Music's public API cannot remove a track from a library playlist: Apple's own Playlists overview enumerates the surface as read, add playlists, add tracks, and nothing else — `VERIFIED · docs`, which does not block 002 but does block S17 and the staged-diff work in a later workstream, and makes `pod-edit-playlist`'s `remove` and `reorder` fields unimplementable on the launch provider.**

# Apple Music capability spike — S1 (revision 2)

Revision 2 addresses the review's four Major and six Minor findings, applies rulings **D-022** (two-axis labels) and **D-023** (`ratingStars` is not a provider capability), produces the full row 30 blast radius that **D-019**'s correction block assigns to this file, and records a real defect in this document's own row 20 experiment found by the empirical-probe slice.

---

## How to read this document

**Method.** Docs-only, as mandated (H-2). **No authenticated API call was made, and no finding rests on one.** Evidence is Apple's own published documentation, read through the DocC JSON that backs `developer.apple.com` (`https://developer.apple.com/tutorials/data/documentation/…json`), plus Apple's published MusicKit-on-the-Web v3 reference at `https://js-cdn.music.apple.com/musickit/v3/docs/` — which is where `https://developer.apple.com/musickit/web/` sends you (**302**, corrected from revision 1's "301"), making it the official v3 reference.

### Labels — two axes, per D-022

Every row carries **one value from each axis**:

| Axis | Values | Answers |
|---|---|---|
| **Evidential strength** | `VERIFIED` · `LIKELY` · `UNVERIFIED` | How good is the evidence? |
| **Provenance** | `docs` · `live` | Was this demonstrated against the running API, or read? |

**The operative rule, stated here because this document is where it will be read: `docs` provenance is NEVER "settled".** No screen, tool schema or `supports()` value may be treated as final on `docs` alone. It may be *built on* provisionally, but it stays visible as unconfirmed. **Only `live` closes a row.** Every row in this document is `docs`. **Nothing here is settled**, including the rows whose evidential strength is `VERIFIED`.

This supersedes revision 1's `VERIFIED-docs`, which collapsed the two axes and disarmed 001 §15.3 failure mode 14's tripwire. Same evidence, honest provenance.

### What `VERIFIED · docs` means on a negative finding

Rows 10, 11, 18, 21a and 30 are *negative* findings, and a negative is rarely a sentence in a doc. Where I write `VERIFIED` on a negative, the evidence is an **exhaustive enumeration of a documented surface** — the full endpoint index of the Apple Music API, the full property/method index of the MusicKit v3 reference — plus, where available, an affirmative Apple sentence describing the surface positively. I say so at each row rather than burying it.

**One scoping correction the review earned (Minor 5).** Apple documents API surface **in its guides as well as its reference index** — `setQueue({station})` is documented only on the *Playing Catalog Stations* guide page, not on the `Queue` reference page. So "the reference index is exhaustive" is not by itself the closed-surface argument revision 1 claimed. Where it matters I now say **which pages were read**, and for row 18 the negative was re-checked across all 19 doc modules, guides included.

**Apple Developer Forums replies are corroboration, never the basis of a label**, even from Apple staff — the forums are not published documentation. Third-party repos and blogs are capped at `LIKELY` and named.

---

## Row 10 — Can the Apple Music API REMOVE tracks from a library playlist?

**Question.** Can a browser client remove a track from a user's Apple Music library playlist through the public Apple Music API?

**Finding. No.**

**The strongest evidence is affirmative, not an argument from absence** (this is the review's suggestion, and it is a better primary source than the one revision 1 led with). Apple's Playlists overview page describes the entire capability set of the playlists surface in one sentence:

> **"Get the contents of playlists, add new playlists to the user's library, and add tracks to an existing playlist."**
> — *Playlists*, https://developer.apple.com/documentation/applemusicapi/playlists-api

Read, add a playlist, add tracks. That is Apple enumerating its own surface positively and exhaustively, and removal is not in it.

The endpoint index agrees. The Playlists API has exactly one mutation topic group, **"Creating and Modifying User Playlists"**, holding **five entries — three endpoints and two request objects** (corrected from revision 1's "exactly three entries", Minor 2):

- *Create a New Library Playlist* — `POST /v1/me/library/playlists`
- *Add Tracks to a Library Playlist* — `POST /v1/me/library/playlists/{id}/tracks`
- *Add a Resource to a Library* — `POST /v1/me/library`
- `LibraryPlaylistCreationRequest`, `LibraryPlaylistTracksRequest` *(request-body objects, not endpoints)*

The one endpoint that adds tracks is documented as positionally append-only:

> **"Add new tracks to the end of a library playlist."**
> — https://developer.apple.com/documentation/applemusicapi/add-tracks-to-a-library-playlist

And across the whole API there are **nine** `DELETE` endpoints, not ten (corrected, Minor 1) — all of them ratings, none of them playlist membership: Personal Album, Music Video, Playlist, Song and Station ratings, plus Library Album, Library Music Video, Library Playlist and Library Song ratings. Reproduce with the `applemusicapi` render index and a title regex for `delete|remove|update|replace|reorder|modif|edit|patch|put`; the only other hits are four section titles containing "Modifying" and the `EditorialNotes` object.

**Label: `VERIFIED · docs`.** Basis: an affirmative Apple sentence enumerating the surface, corroborated by an exhaustive endpoint index. **Not settled** — only `live` closes it.

**Corroboration (not the basis of the label).** Apple staff have said this outright in the Developer Forums, over six years:

> "Only the ability to add items to the Cloud Library and editable playlists is currently available in the Apple Music API."
> — Apple staff, Feb 2019, https://developer.apple.com/forums/thread/107807

> "…the update is that Apple Music API only allows adding to the cloud library Cloud Library and editable playlists at this time. We are still aware that developers using Apple Music API would like the ability to work with the library in additional including deleting tracks from the user's library."
> — Apple staff, Dec 2020, same thread

Still true at the most recent public exchange found, **October 2025**: a developer asked "How do I DELETE tracks from the playlist? The documentation does not mention a method for this"; Apple's DTS Engineer replied only by pointing at the `canEdit` attribute, offered **no deletion method**, and the thread closed unresolved. https://developer.apple.com/forums/thread/805461

**The one place removal DOES exist, and why it does not help us.** Apple's *Swift* MusicKit has `MusicLibrary.edit(_:name:description:authorDisplayName:items:)`:

> **"Edits a playlist that your app has created including items to rebuild the list of entries."** … **"This function will throw an error if your app attempts to edit a playlist that another app created."**
> — https://developer.apple.com/documentation/musickit/musiclibrary/edit(_:name:description:authordisplayname:items:)

Documented availability: **iOS 16.0, iPadOS 16.0, tvOS 16.0, visionOS 1.0, watchOS 9.0**. No web, no macOS. Apple's engineer, Jun 2022:

> "Editing playlists does support removing tracks from a playlist… That being said, you cannot remove items from any playlist, but only playlists users have created in your specific app. **By the way, this functionality is currently only available on Apple platforms.**"
> — https://developer.apple.com/forums/thread/707759

and in follow-up: *"You cannot edit playlists created via Apple Music API."* Two independent blocks — wrong platform, wrong playlist provenance.

**001 §14.3 row 10 was right to invert the usual assumption. The public API is append-only, and has been for the API's whole life.**

---

## Row 11 — Can it REORDER tracks in a library playlist?

**Question.** Can a browser client change the order of tracks in a user's Apple Music library playlist?

**Finding. No — a strictly harder "no" than row 10.** Reordering needs either a positional write (`PUT`/`PATCH` on the tracks relationship) or a full-list replace. Neither exists:

- The documented mutation set is the three additive `POST`s above; the Playlists overview sentence names no third verb.
- The only playlist-tracks request body is `LibraryPlaylistTracksRequest` — **"A request to add tracks to a library playlist"**, with **exactly one property**, `data`, *"A list of dictionaries with information about the tracks to add."* No position, index, `insert_before` or `range_start`. https://developer.apple.com/documentation/applemusicapi/libraryplaylisttracksrequest
- The insertion point is fixed by the endpoint's own abstract: *"to the end of a library playlist."*

Apple staff, Feb 2022, on `DELETE`/`PUT` generally:

> "We do not communicate status of any feature request other than to say that we are either investigating the feasibility, or that we have released an update including said feature. In this particular case, all I can say is that we have heard the request."
> — https://developer.apple.com/forums/thread/107807

**Label: `VERIFIED · docs`. Not settled.**

**No workaround exists.** Reorder-by-rebuild needs removal, and row 10 says removal is unavailable. There is no sequence of documented calls that produces a reordered Apple library playlist.

---

## Row 18 — Does MusicKit JS v3's queue object support arbitrary splice / remove / reorder?

**Question.** Can we splice, remove from, or reorder the *playback queue* (as distinct from a saved playlist) in MusicKit on the Web v3?

**Finding — documented surface: no arbitrary remove, and no reorder at all.** Apple's v3 reference documents the `Queue` class as **properties only** — seven of them, zero methods:

`currentItem` · `isEmpty` · `items` · `length` · `nextPlayableItem` · `position` · `previousPlayableItem`

> "The Queue represents an ordered list of MediaItems to play, and a pointer to the currently playing item, when applicable."
> — *Reference › JavaScript › Queue*, https://js-cdn.music.apple.com/musickit/v3/docs/?path=/docs/reference-javascript-queue--page

`items` is **"An array of all the MediaItems in the queue"**, `Array<MediaItem>`. The docs do not say mutating it mutates the queue, and no `Queue` method is documented at all.

Queue mutation in the documented surface happens through **MusicKit-instance methods** — 24 of them, of which these touch the queue:

| Operation | Documented v3 API | Verdict |
|---|---|---|
| Replace whole queue | `setQueue(QueueOptions)` | supported |
| Append | `playLater` — *"Inserts the MediaItem(s) defined by QueueOptions after the last MediaItem in the current queue."* | supported |
| Insert next | `playNext` | supported |
| Clear | `clearQueue` | supported |
| Jump to index | `changeToMediaAtIndex` / `playAt` | supported |
| **Remove one arbitrary item** | — | **absent** |
| **Insert at arbitrary index** | — | **absent** |
| **Reorder / move** | — | **absent** |

**`QueueOptions` content selectors — scoped claim (Minor 5).** *On the `Queue` reference page* Apple documents exactly four type pairs — `album`/`albums`, `musicVideo`/`musicVideos`, `playlist`/`playlists`, `song`/`songs` — plus `url`, and the playback options `repeatMode`, `startPlaying`, `startTime`. None carries an index or position parameter. **`station` is a fifth selector**, documented not on that page but on the *Playing Catalog / Live / Personal Stations* guide pages — and this document relies on it two rows later for row 20. Revision 1 called the reference-page list "exhaustive" without that qualifier; it is exhaustive *for that page*, not for the API.

**Label: `VERIFIED · docs`** for "the documented v3 API supports replace / append / insert-next / clear / jump, and supports no arbitrary remove, insert-at-index, or reorder." Re-checked across **all 19 doc modules** (essentials, how-to, reference, tech-notes), guides included: `splice` 0, `removeQueueItem` 0, `updateItems` 0, `insertAt` 0, `reorder` 1 (a SCSS mixin), `move` (all CSS `cursor: move`). **Not settled.**

### Sub-finding — undocumented runtime methods exist. Do not build on them.

Apple's shipped `https://js-cdn.music.apple.com/musickit/v3/musickit.js` (614,791 bytes) contains a `Queue` class with methods **absent from the reference**: `splice(start, deleteCount, items = [])`, `append(items)`, `updateItems(items)`, `removeQueueItems(predicate)`, `indexForItem`, `item(index)`, `clearAfterCurrent()`, `clear()` — and `remove(index)`, which is explicitly self-deprecating:

```js
remove(e){ if(deprecationWarning("remove",{message:"The queue remove function has been deprecated"}),
            e===this.position) throw new MKError(MKError.Reason.INVALID_ARGUMENTS);
           this.splice(e,1) }
```

`splice` publishes `queueModified` and `queueItemsDidChange`, so a splice would propagate to listeners. **There is no `reorder` or `move` method at any level** — a reorder would have to be emulated as splice-out plus splice-in, or a whole-array `updateItems()`.

**Label on the sub-finding: `LIKELY · docs`** — Apple's own shipped code is a real primary source, but this is *minified implementation, not documentation*, one method carries an explicit deprecation warning, and none of it is contractual.

**`supports("queueRemove")` and `supports("queueReorder")` stay `false`.** Three independent reasons: 001 §14.4's "never invent parity"; Apple deprecating its own undocumented method; and no reorder primitive existing at all.

---

## Row 20 — Is there a public API for starting a station SEEDED FROM A SPECIFIC TRACK?

> ### ⚠ The experiment this document originally specified does not work. Do not run revision 1's version.
>
> Revision 1 named a settling probe of **three songs by three different artists**, with the failure condition *"if the same artist's songs all return one identical `ra.*` id, it is an artist station."* **That fixture cannot produce that observation** — it never places two songs by one artist side by side. Worse, the success condition is not diagnostic either: three songs by three *different* artists yield three different station ids under **both** hypotheses, because the artists differ too. Distinct ids across distinct artists is exactly what the artist-station hypothesis predicts.
>
> **Run as I specified it, three distinct ids would have upgraded row 20 to supported on evidence that does not support it**, flipping `supports("stationSeedFromTrack")` to `true` on a false positive — the precise failure 001 §14.4 exists to prevent. Reading `attributes.name` for a "song-shaped" name is not a rescue; it is a naming heuristic that presumes Apple's copy convention.
>
> This was caught by the empirical-probe slice, not by me. **A corrected, discriminating design exists in that slice's evidence file** — three artists × **two songs each** (the within-artist comparison, which is the decisive one), plus `GET /v1/catalog/us/artists/{artistId}/station` as a control. I identified `Artists` carrying an identically-named `station` relationship as the reason to doubt and then never measured it; the corrected design measures it. **A reader who finds this row before that file must not run the old fixture.**

**Question.** Can we do the in-app "start a station from this song" from a browser?

**Finding — the mechanism is documented; the semantics are not.** Two documented halves:

1. **A song has a station.** The `Songs` resource documents exactly seven relationships — `albums`, `artists`, `composers`, `genres`, `library`, `music-videos`, **`station`**:
   > **"station — The station associated with the song. By default, `station` is not included. Fetch limits: None"**
   > — https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary

   Reachable at `GET https://api.music.apple.com/v1/catalog/{storefront}/songs/{id}/{relationship}`, or inline via `?include=station`.

2. **A station identifier plays.** MusicKit documents playback from a bare `ra.*` id:
   ```js
   await music.setQueue({ station: 'ra.985496511' });
   await music.play();
   ```
   — *Playing Catalog Stations*, https://js-cdn.music.apple.com/musickit/v3/docs/?path=/docs/getting-started-playing-apple-music-stations-catalog-stations--page

The two-call path **song → its station → `setQueue({station})`** is documented end to end.

**What is NOT documented is what that station actually is.** Apple's entire description is five words: *"The station associated with the song."* Not "seeded from". Not personalised. And the identical relationship name `station` also exists on `Artists`, which is a live reason to doubt that "associated" means track-level.

**Label: `LIKELY · docs` (supported).** What implies it: the relationship is per-*song*, `Fetch limits: None` (a single object, not a list), returning a `ra.*` id of the shape `setQueue({station})` accepts. What is missing: any statement that the station is track-seeded rather than track-*adjacent*.

**`supports("stationSeedFromTrack")` is `false`** — unresolved means absent.

---

## Row 21 — Is there a lyrics endpoint? What entitlement does third-party DISPLAY require? Are lyrics time-synced?

### 21a — Is there a public lyrics endpoint?

**Finding. No.** Apple publishes a *flag* saying lyrics exist and no way to fetch them:

> **"hasLyrics — Indicates whether the song has lyrics available in the Apple Music catalog. If `true`, the song has lyrics available; otherwise, it doesn't."**
> — https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary

The full documented `Songs` attribute set is 26 fields — `albumName`, `artistName`, `artistUrl`, `artwork`, `attribution`, `audioVariants`, `composerName`, `contentRating`, `discNumber`, `durationInMillis`, `editorialNotes`, `genreNames`, **`hasLyrics`**, `inFavorites`, `isAppleDigitalMaster`, `isrc`, `movementCount`, `movementName`, `movementNumber`, `name`, `playParams`, `previews`, `releaseDate`, `trackNumber`, `url`, `workName`. **No lyrics content field.** The seven documented relationships contain no lyrics relationship. No lyrics endpoint exists anywhere in the API.

**Label: `VERIFIED · docs`** — no public lyrics endpoint exists. **001 §14.3 row 21's premise that `/v1/catalog/{sf}/songs/{id}/lyrics` "exists" is not supported by any Apple documentation.** That URL appears only in third-party reverse-engineering work. This correction was attacked from four directions in review and held:

| Source | Method | `lyric` hits |
|---|---|---|
| Apple Music API | full render index, 608 nodes | **0** |
| Swift MusicKit | full render index, 1187 nodes | **1** — `var hasLyrics: Bool`, nothing else |
| Apple Music Feed API | full render index | **0** |
| MusicKit on the Web v3 | all 19 doc modules | **0** |

**Sub-finding, named as required.** An undocumented `/v1/catalog/{sf}/songs/{id}/lyrics` and a word-synced `/syllable-lyrics` variant are described by third parties as what Apple's own web player uses, requiring a `Media-User-Token` and a *privileged* developer token ordinary keys lack. **Named third-party sources, `LIKELY · docs` at absolute best and unusable regardless:** `rryam/MusanovaKit` (https://github.com/rryam/MusanovaKit — self-described as "Explore and experiment with private Apple Music API endpoints") and `binimum/apple-music-web-components` (https://github.com/binimum/apple-music-web-components). Both are explicitly private-API projects: undocumented, unentitled, breakable without notice, plausibly a terms violation. **Not a capability.**

Corroborating oddity: Apple's shipped `musickit.js` v3 *does* contain lyric identifiers — `lyricsPlay`, `lyricsStop`, `LYRIC_DISPLAY`, `lyric-id`, `lyric-language` — but every one sits inside the **analytics event-name enum and metrics field schema**, gated on `event-type === LYRIC_DISPLAY`, reading a `lyricDescriptor` the SDK never populates. No fetch, no render, no accessor. This is evidence *against* a usable third-party path.

### 21b — What entitlement does third-party display require?

**Label: `UNVERIFIED · docs`.** Apple publishes no entitlement, capability, program or terms clause granting a third party the right to display Apple Music lyrics. The absence is total — nothing in the Apple Music API docs, the MusicKit web docs, or the Feed docs speaks to it either way. I will not guess at a licensing posture.

**What would settle it:** nothing callable. This is a licensing question, not an API question — it takes a written answer from Apple DTS or an Apple Music partnership contact. **Do not schedule engineering against it.**

### 21c — Are lyrics time-synced?

**Label: `UNVERIFIED · docs`, and moot.** No public endpoint returns lyrics in any form, so there is no public statement about timing. Third-party reports of a `syllable-lyrics` endpoint imply word-level sync in Apple's *private* API, which says nothing about a hypothetical public one.

**Row 21 headline: `VERIFIED · docs` that no public lyrics endpoint exists.** `supports("lyrics")` and `supports("lyricsSynced")` are both `false`.

---

## Row 30 — Is offline audio (download-for-offline) available to a browser client at all?

**Question.** Can a browser client download Apple Music audio for offline playback?

**Finding. No documented path exists, on either half of the stack.**

- **MusicKit on the Web v3 reference:** zero occurrences of `offline`, `persist` or `cache`. **Four occurrences of `download`** — corrected from revision 1's "zero" (Info finding): all four are the CSS icon-set class `icon-downloadcircle`, i.e. stylesheet scaffolding, not API. **The prose claim was true; the literal one was not.** There is no asset accessor, no download method, no persistence API, no `MediaKeySession` control.
- **Apple Music API:** no downloads endpoint. `Songs.Attributes.previews` exposes only *"The preview assets for the song"* — the 30-second clips.
- **Playback is DRM-gated**, the structural reason offline is not on the table:
  > **"A notification for indicating that media playback has fallen back to preview mode due to an inability to configure DRM for the current item in the current environment."**
  > — `drmUnsupported`, *Reference › JavaScript › Events*

  The error index includes `WIDEVINE_CDM_EXPIRED`, confirming EME/CDM dependency. `previewOnly` is documented as the only non-DRM path: *"If the app does not have user authorization, then playback is restricted to non-DRM preview assets, which are snippets of the full media."*

**Label: `VERIFIED · docs`** — no download or offline-audio capability is documented. **Not settled.**

**Sub-finding, `LIKELY · docs`:** no undocumented path exists either. Offline EME playback needs a `persistent-license` `MediaKeySession`, which needs Apple's license server to issue persistent licenses; nothing offers one. Corroborating, from the shipped runtime: `createFieldFn("offline",()=>!1)` — MusicKit on the Web always reports `offline: false` to Apple's own analytics. Minified implementation, hence `LIKELY`.

---

## Bonus finding (outside the six rows)

**001 §14.3 row 7 — library remove on Apple — was `LIKELY` (not supported). It is now `VERIFIED · docs` (not supported).** Same exhaustive enumeration: `POST /v1/me/library` adds; no removal endpoint exists; the only nine `DELETE`s are ratings. Apple staff, Dec 2020, name it explicitly (*"…including deleting tracks from the user's library"*). §14.3's posture — **(c) hide on Apple** — stands and can now be built without a caveat.

**This finding has a consequence revision 1 missed. See `pod-add-to-library` below.**

---

# CONSEQUENCES

What changes in the 001 surfaces. **Everything here is `docs` provenance and therefore provisional under D-022** — build on it, but nothing is settled.

## Rows 10 + 11 — playlist remove and reorder unimplementable on the launch provider

| Surface | Change |
|---|---|
| **`pod-edit-playlist`** (§7.2) | Registers on Apple with **`remove` and `reorder` absent from its `inputSchema` entirely**, plus a `description` stating it can only add. §14.6's "partially supported → the schema narrows" rule; its conditional ("if rows 10–11 confirm as unsupported") is now unconditional for Apple. |
| **S08 staged diff** (§8.5) | Shows **`+` rows only**. No `−` rows, no move indicators. Build the additive-only variant as its natural shape, not a crippled three-verb one. |
| **Drag handles** | **Do not render** on any Apple playlist surface. Hide, never grey (§14.4). |
| **Undo / the Engraving (B07)** | A playlist add is **not undoable on Apple** — undo would require removal. §8.5's two-press confirm carries the whole safety burden; the `⟲` affordance must not render on Apple playlist-add entries. |
| **B04 / S27 `unsupportedReason()`** | Needs a string. Suggested, in §11.0 voice: `Apple Music only lets other apps add to a playlist.` |

**Correction to revision 1 (Minor 3).** Revision 1 wrote *"The row's action sheet loses its `Remove from Playlist` item entirely on Apple."* **No such item has ever existed in 001.** §4.3's canonical action sheet is `(Play Next, Play Last, Add to Library, Start Station, Share, Show Lyrics, Go to Album, Go to Artist)`. `grep -rn "Remove from"` across 001 returns exactly one hit — **`Remove from Library`** at `pm-spec.md:2074`, in §15.1's S08 DoD, governed by row **7**, not rows 10/11. **Nothing is removed from the action sheet by rows 10/11.** The consequences section's one job is to be accurate about 001's contents, and revision 1 invented a control to delete.

## Row 18 — queue remove, reorder and insert-at-index unavailable

§14.3 row 18 assumed Apple might be the good case and Spotify the bad one. **Both are bad in the documented surface.**

| Surface | Change |
|---|---|
| **S17 Up Next** (priority 8) | Drag handles and swipe-to-remove **do not render on Apple either**. S17 is a read-only Up Next with append, clear and jump-to-index on **both** providers. §14.3 row 18's note — *"design it so the read-only variant is not a broken-looking version of the full one"* — is now the **only** variant. |
| **D02 Sidecar · Up Next** (§3.3, `pm-spec.md:155`) | **Newly named (Major 4).** Its stated purpose is literally **"Drag to reorder"** and its spec is *"Full sidecar height; drag handles; source chips per row."* On Apple the purpose is unachievable and the drag handles do not render. **D02 needs a new stated purpose before it is designed** — read-only full-queue visibility with source provenance. Revision 1 named S17 only. |
| **`pod-queue-reorder`** | **Not registered on Apple.** §14.6's unregistered-on-Spotify list extends: unregistered on both. |
| **`pod-queue-insert`** (§7.2, `pm-spec.md:774`) | **Newly named (Major 4).** Its schema is `position?: enum(next,end,index)`, `index?: number`, returning `displacedCount`, escalating to `REVIEW` when `displacedCount > 3`. MusicKit v3 documents `playNext`, `playLater`, `setQueue` and `changeToMediaAtIndex` and **no insert-at-arbitrary-index** — so `position: "index"`, the `index` parameter, and the entire `displacedCount` gate are unimplementable on Apple. Under §14.6 the enum narrows to `(next, end)` on Apple and `index` leaves the schema. **`displacedCount` can only ever be 0**, which makes the `> 3` REVIEW escalation dead code on the launch provider — worth knowing before the agent-safety work is estimated. |
| **`pod-queue-clear`** | **Still registers on Apple** — `clearQueue` is documented. Stays Spotify-only-unregistered. |
| **Retained on Apple** | `playNext`, `playLater`, `setQueue`, `changeToMediaAtIndex`. S17 keeps tap-to-jump and append. |

## Row 20 — station-from-track is `LIKELY` and its probe was mis-specified

No surface changes, and none should be planned. **Revision 1 contradicted itself here** — it opened "no surface changes yet, and none should be planned on it" and then changed a surface in the same paragraph. Stated cleanly:

- **`supports("stationSeedFromTrack")` is `false` today.** Under §14.6 that forces `track` out of **`pod-start-station`**'s `seedType: enum(track,artist,genre,station)` on Apple — **newly named (Major 4)**; the tool registers with `seedType: enum(artist,genre,station)`.
- **`Start Station` stays in §4.3's action sheet**, because `artist`, `genre` and `station` seeds remain available. Only the track seed is unavailable. Revision 1 implied the whole item disappears; that was wrong.
- **S18 Radio keeps its catalog, live and personal station rows** — all `VERIFIED · docs`.
- If the corrected probe resolves *against* track-seeding, the above becomes permanent. If it resolves *for*, `track` returns to the enum and `supports()` flips — **but only on `live` provenance.**

## Row 21 — lyrics resolve unfavourably

| Surface | Change |
|---|---|
| **S16 Lyrics** (§3.1 row 16, `pm-spec.md:117`) and **D04 Sidecar · Lyrics** (§3.3 row 44, `:157`) | **Cut, or reduced to an honest empty state, on both providers.** §14.3 row 21 planned **(d) refuse** for Spotify only; it now applies to Apple too. If S16 survives it is one line — suggested: `Apple Music doesn't offer lyrics to other apps.` |
| **§4.3 centre-button cycle** (`:274`) | `Volume → Scrub → Rate → Lyrics → Volume` **drops to three stops.** Correctly named in revision 1. |
| **§5.1 row 3** (`:544`) | **Newly named (Minor 4).** Reads *"Time-synced lyrics as the **fourth stop** in the Now Playing center-button cycle (S16), plus a full-width sidecar surface on desktop (D04)."* This is the modernisation that justified the feature; it is now unbuildable and the row needs cutting or re-scoping. |
| **§4.3 action sheet** (`:275`) | **Newly named.** `Show Lyrics` is one of its eight items and must go. |
| **§4.4 rotate mapping** (`:268`) | **Newly named.** *"S16 Lyrics — Scroll lines; breaks auto-sync and shows a 'Following you' chip."* Dead with S16. |
| **§4.6 keyboard map** (`:403`) | **Newly named.** `L → Lyrics S16`. |
| **§11.6 empty states** (`:1699`) | **Newly named.** `S16 no lyrics — "No lyrics for this one."` |
| **§12 open question 4** (`:1767`) | **Newly named.** Asks whether S16 survives the 320×240 raster — moot; withdraw it rather than leave the designer answering a dead question. |
| **`pod-get-lyrics`** (`:782`) | **Not registered on any provider.** Consider deleting it from the §7.2 roster rather than carrying a permanently-unregistered entry — **PM call, flagged not taken.** |
| **`hasLyrics`** | We can still *know* a song has lyrics. **Do not surface it.** A flag saying "lyrics exist and you can't see them" is exactly the disabled-control anti-pattern §14.4 forbids. |

**Two corrections to revision 1 (Minor 4).** It named §10.1 and §11.8 as needing the four→three edit. **Neither contains the cycle:** §10.1's S13 state matrix (`:1377-1391`) never mentions the centre cycle, and §11.8 (`:1732-1755`) has no cycle strings. And **§15.1's S13 DoD item 4 (`:2023`) needs no edit at all** — it is already written conditionally: *"the cycle is three stops, not four, when `supports("lyrics")` is false."* 001 anticipated this row correctly in the one place that matters most.

## Row 30 — offline audio unavailable · **full blast radius**

**This is the enumeration D-019's correction block assigns to this file.** Offline is now **cut repo-wide** (D-019): §14.2 gains no `offline` capability member, §5.1 row 10 and J6b's `Play downloads` path are cut, and the `⤓` glyph is cut everywhere.

**Correction to revision 1 (Major 3).** Revision 1 said *"001 §5.1 row 10's existing assumption — a Service Worker cache of shell, artwork and metadata, never audio — is correct and should be treated as settled."* **That is wrong, and it propagated into D-019.** §5.1 row 10 (`:551`) actually reads:

> Explicit **Downloaded** state: **a download glyph per row, a "Downloaded only" filter** that survives the offline transition, **and** a Service Worker holding the shell, the art cache, and the last 200 rows of every visited list.

The Service Worker clause is **one third of the row**. The other two thirds — the per-row download glyph and the `Downloaded only` filter — are **killed by this row's own finding**. §5.1 row 10 is *partly invalidated*, not confirmed. Revision 1 also carried 001's own unchecked "five screens" estimate forward as fact without testing it. **§10 alone carries seven affected screen states before the copy deck is opened.**

**Counts, reproducible.** In `pm-spec.md`: `grep -c 'download'` → **25 lines**; case-insensitive → **30 lines**; **45 total occurrences**; the `⤓` glyph appears on **2 lines**.

### Every affected location

| § | Line | What it promises | Kind of change |
|---|---|---|---|
| §5.1 row 10 | 551 | download glyph per row; `Downloaded only` filter *(Service Worker clause survives)* | **design cut, partial** |
| §7.2 `pod-search` | 758 | returns `downloaded` per item — **a field nothing can populate** | **tool-schema change** |
| §7.3 | 807 | "library-and-**downloaded** tools remain" while `DISCONNECTED` | registration-matrix edit |
| §8.5 | 1120 | `Sign out` — "downloads stop" | copy |
| §9 J6a | 1334, 1336, 1337 | `214 downloaded songs still play` · `Play downloads` · S12 scope auto-switch to `Downloaded only` · `Searching downloads only.` | **journey path cut** |
| §9 J6b | 1344, 1345, 1348 | "Downloaded audio continues" · `Downloads keep playing.` · "Full browse of downloads" | **journey path cut** |
| §9 J6c | 1356 | `Reload` · `Play downloads` | **journey path cut** |
| §10.1 S13 | 1384 | `214 downloaded songs still play.` / `Play downloads` | per-screen Offline row |
| §10.2 S03 | 1400 | **`Downloads` row inserted at position 2** and lit; `214 songs are downloaded` | per-screen Offline row |
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
| §14.3 row 30 | 1945 | the row itself | now resolved |

**Seven per-screen `Offline` rows in §10** — S13, S03, D01, S25, S08, S12, S17. **Not five screens.**

**What survives:** the Service Worker cache of **shell, artwork and metadata**. `DISCONNECTED` becomes **browse-cached-metadata-only**. **Nothing renders a greyed or broken download affordance** — absent, not disabled (U15).

## Row 7 (bonus) — `pod-add-to-library`'s undo is a control that cannot work

**Newly named (Major 4), and it is the one this document should have caught itself.** §7.2's `pod-add-to-library` (`:765`) carries `UNDO` and actuates:

> a 20px in-raster footer row reads `Added to your library.  ⟲ Undo` for 30s

**An undo of a library add is a library remove**, and row 7 establishes that Apple's public API cannot remove from the library. Revision 1 spotted this exact problem for playlist add one section earlier and missed the identical, more explicitly-specified case here. Under 001 §15.3 #10 this is a control that cannot work.

**Change:** the `⟲ Undo` footer does not render on Apple for `pod-add-to-library`. The tool keeps `RW` but loses `UNDO` on the launch provider; the confirmation footer reads `Added to your library.` with no affordance. The `alreadyPresent: true` no-op path is unaffected.

---

## Apple `supports()` matrix — ready to paste

Every unresolved row is `false`. **A capability is absent until proven present.** All values are `docs` provenance — provisional, never settled (D-022).

```ts
// Apple Music capability matrix.
// Derived from the Apple Music API reference and the MusicKit on the Web v3
// reference. Provenance: docs — read, not demonstrated against the live API.
// No value here is settled; every one may be built on provisionally only.
const APPLE_SUPPORTS: Record<Exclude<Capability, "ratingStars">, boolean> = {
  // ── Resolved FALSE ──────────────────────────────────────────────────────
  playlistRemoveTracks:  false, // no endpoint exists; API is append-only
  playlistReorder:       false, // no positional write exists
  queueRemove:           false, // undocumented + self-deprecated only
  queueReorder:          false, // no such method, documented or not
  stationSeedFromTrack:  false, // LIKELY supported, UNPROVEN -> false
  lyrics:                false, // no public endpoint exists
  lyricsSynced:          false, // moot while `lyrics` is false
  libraryRemove:         false, // no endpoint exists

  // ── Confirmed TRUE ──────────────────────────────────────────────────────
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

1. **`ratingStars` has been removed entirely (D-023).** It is not a provider capability: §14.2 omits stars from `MusicProvider` on purpose, and §14.3 row 22 makes them a **local-only device rating** emulated on both providers, stored in IndexedDB, synced nowhere. A `supports()` key implies a provider question and there is none. **Revision 1 listed it as "resolved FALSE by this spike" without ever examining row 22** — the same flag-what-you-did-not-examine treatment that was correctly given to `offline` was owed here and withheld. `ratingStars: false` would have hidden S15's stars and stripped `pod-rate-track`'s `stars` field on Apple, deleting a designed both-provider feature.
2. **This creates a live type tension, flagged not resolved.** §14.2's `Capability` union has **26 members and still includes `ratingStars`**, so a plain `Record<Capability, boolean>` will not compile without it. The `Exclude<>` above keeps this honest and makes the deviation visible at the type level. The clean fix is to drop `ratingStars` from the union in 001 — **a 001 amendment, which is the lead's to record, not mine to make.**
3. **`offline` is not a member of the union and, per D-019, will not become one.** Row 30 therefore has no `supports()` key, by decision rather than omission.
4. **`playlistAddTracks: true` carries a positional constraint `supports()` cannot express.** Apple appends to the end, always. Anywhere the UI or a tool implies an insertion point within a playlist, it will be wrong on Apple. The `pod-edit-playlist` and `pod-queue-insert` schema narrowings above are the mitigation.
