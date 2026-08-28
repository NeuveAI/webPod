# Apple Music capability spike — S1

**Row 10 answer, first line, as required: the public Apple Music API documents no endpoint that removes a track from a library playlist — the entire "Creating and Modifying User Playlists" section is additive only — so `playlistRemoveTracks` is NOT SUPPORTED on the launch provider. `VERIFIED-docs`.**

---

## How to read this document

**Method.** Docs-only, as mandated (H-2: no Apple Developer account, no signed MusicKit developer token). **No authenticated API call was made, and none of the findings below rests on one.** Evidence is Apple's own published documentation, read through the DocC JSON that backs `developer.apple.com` (`https://developer.apple.com/tutorials/data/documentation/…json`), plus Apple's published MusicKit-on-the-Web reference at `https://js-cdn.music.apple.com/musickit/v3/docs/` (which is where `https://developer.apple.com/musickit/web/` redirects, 301, so it is the official v3 reference).

**Labels**, per 001 §14.0 and the S1 dispatch:

| Label | Meaning here |
|---|---|
| `VERIFIED-docs` | Apple's published docs state it plainly. Quoted and linked. |
| `LIKELY` | Strongly implied but not stated. The thing that implies it is named. |
| `UNVERIFIED` | Could not be established from docs. The exact call that would settle it is named. |

**One honesty note the reviewer should hold me to.** Rows 10, 11, 18, 21 and 30 are *negative* findings, and a negative is rarely a sentence in a doc. Where I write `VERIFIED-docs` on a negative, the evidence is an **exhaustive enumeration of a documented surface** — the full endpoint index of the Apple Music API, the full property/method index of the MusicKit v3 reference — plus, where available, an affirmative Apple statement. **It is not Apple writing "you cannot do this."** I say so at each row rather than burying it. Where the only evidence was a forum post or a third-party repo, the label is `LIKELY` or `UNVERIFIED` and the source is named, per the dispatch's instruction.

**Apple Developer Forums replies are treated as corroboration, never as the primary source for a `VERIFIED-docs` label**, even when the reply is from Apple staff — the forums are not published documentation.

---

## Row 10 — Can the Apple Music API REMOVE tracks from a library playlist?

**Question.** Can a browser client remove a track from a user's Apple Music library playlist through the public Apple Music API?

**Finding. No.** The Apple Music API's Playlists section has exactly one topic group for mutation, titled **"Creating and Modifying User Playlists"**, and it contains exactly three entries:

- *Create a New Library Playlist* — `POST /v1/me/library/playlists`
- *Add Tracks to a Library Playlist* — `POST /v1/me/library/playlists/{id}/tracks`
- *Add a Resource to a Library* — `POST /v1/me/library`

There is no remove, no delete, no update, no replace. The only `DELETE` verbs anywhere in the Apple Music API documentation are the ten ratings deletions (`Delete a Personal Song Rating`, `Delete a Personal Library Playlist Rating`, and so on) — none of which touch playlist membership.

The one endpoint that adds tracks is documented as positionally append-only:

> **"Add new tracks to the end of a library playlist."**
> — *Add Tracks to a Library Playlist*, https://developer.apple.com/documentation/applemusicapi/add-tracks-to-a-library-playlist

Endpoint index that contains no removal verb: https://developer.apple.com/documentation/applemusicapi/playlists-api

**Confidence: `VERIFIED-docs`.** The evidence is the exhaustive documented endpoint set, plus the affirmative "to the end of" phrasing. Apple does not print a sentence saying removal is impossible; it simply publishes no endpoint for it, and we may only build on documented API.

**Corroboration (not the basis of the label).** Apple staff have said this outright in the Developer Forums, repeatedly and over six years:

> "Only the ability to add items to the Cloud Library and editable playlists is currently available in the Apple Music API. Thank you for the feedback, we understand developers would like the ability to work with the library in additional ways using these APIs."
> — Apple staff, Feb 2019, https://developer.apple.com/forums/thread/107807

> "Hi, the update is that Apple Music API only allows adding to the cloud library Cloud Library and editable playlists at this time. We are still aware that developers using Apple Music API would like the ability to work with the library in additional including deleting tracks from the user's library."
> — Apple staff, Dec 2020, same thread

Still true as of the most recent public exchange I could find, **October 2025**: a developer asked "How do I DELETE tracks from the playlist? The documentation does not mention a method for this"; Apple's DTS Engineer replied only by pointing at the `canEdit` attribute, and **offered no deletion method**. The thread closed unresolved. https://developer.apple.com/forums/thread/805461

**The one place removal DOES exist, and why it does not help us.** Apple's *Swift* MusicKit has `MusicLibrary.edit(_:name:description:authorDisplayName:items:)`:

> **"Edits a playlist that your app has created including items to rebuild the list of entries."**
> … **"This function will throw an error if your app attempts to edit a playlist that another app created."**
> — https://developer.apple.com/documentation/musickit/musiclibrary/edit(_:name:description:authordisplayname:items:)

Its documented platform availability is **iOS 16.0, iPadOS 16.0, tvOS 16.0, visionOS 1.0, watchOS 9.0** — Apple platforms only. There is no web. Apple's own engineer said as much when the API shipped:

> "Editing playlists does support removing tracks from a playlist. In the `items` parameter, just pass the items of the playlist without the item you want deleted. That being said, you cannot remove items from any playlist, but only playlists users have created in your specific app. **By the way, this functionality is currently only available on Apple platforms.**"
> — Apple staff (David), Jun 2022, https://developer.apple.com/forums/thread/707759

and, in follow-up, that it cannot even reach playlists we would create:

> "You cannot edit playlists created via Apple Music API, though you can still add to them given that they are not restricted to non-editable."
> — same thread

So even a hypothetical native shim would be blocked twice: wrong platform, and wrong playlist provenance.

**001 §14.3 row 10 was right to invert the usual assumption. The public API is append-only, and it has been for the whole life of the API.**

---

## Row 11 — Can it REORDER tracks in a library playlist?

**Question.** Can a browser client change the order of tracks in a user's Apple Music library playlist?

**Finding. No — and this is a strictly harder "no" than row 10.** Reordering requires either a positional write (`PUT`/`PATCH` on the tracks relationship) or a full-list replace. Neither exists:

- The documented mutation set for library playlists is the three additive `POST`s enumerated in row 10. https://developer.apple.com/documentation/applemusicapi/playlists-api
- The only request body object for playlist tracks is `LibraryPlaylistTracksRequest`, documented as **"A request to add tracks to a library playlist"**, whose single property is *"A list of dictionaries with information about the tracks to add."* There is no position, index, `insert_before`, or `range_start` field. https://developer.apple.com/documentation/applemusicapi/libraryplaylisttracksrequest
- The insertion point is fixed by the endpoint's own abstract: **"Add new tracks to the end of a library playlist."**

Apple staff, Feb 2022, on `DELETE`/`PUT` generally:

> "We do not communicate status of any feature request other than to say that we are either investigating the feasibility, or that we have released an update including said feature. In this particular case, all I can say is that we have heard the request. If you are interested in this, it would be helpful for you to file a ticket on Feedback Assistant explaining your use-case for `DELETE` and `PUT` methods in Apple Music API."
> — https://developer.apple.com/forums/thread/107807

**Confidence: `VERIFIED-docs`.** Same evidentiary shape as row 10: exhaustive endpoint set, plus an affirmative statement that the sole write is positional-append.

**Note on the "delete + re-add" workaround.** It does not exist either. Reorder-by-rebuild needs removal, and row 10 says removal is unavailable. There is no sequence of documented calls that produces a reordered Apple library playlist.

---

## Row 18 — Does MusicKit JS v3's queue object support arbitrary splice / remove / reorder?

**Question.** Can we splice, remove from, or reorder the *playback queue* (as distinct from a saved playlist) in MusicKit on the Web v3?

**Finding — documented surface: no arbitrary remove, and no reorder at all.** Apple's v3 reference documents the `Queue` class as **properties only**. The complete documented member list is:

`currentItem` · `isEmpty` · `items` · `length` · `nextPlayableItem` · `position` · `previousPlayableItem`

> "The Queue represents an ordered list of MediaItems to play, and a pointer to the currently playing item, when applicable."
> — *Reference › JavaScript › Queue*, https://js-cdn.music.apple.com/musickit/v3/docs/?path=/docs/reference-javascript-queue--page

`items` is documented as **"An array of all the MediaItems in the queue"**, type `Array<MediaItem>`. **The docs do not say that mutating this array mutates the queue**, and no `Queue` method is documented at all.

Queue mutation in the documented v3 surface happens through **MusicKit-instance methods**, whose complete documented list is: `addEventListener`, `authorize`, `changeToMediaAtIndex`, `changeToMediaItem`, `changeUserStorefront`, `clearQueue`, `exitFullscreen`, `mute`, `pause`, `play`, `playAt`, `playLater`, `playNext`, `removeEventListener`, `requestFullscreen`, `seekBackward`, `seekForward`, `seekToTime`, `setQueue`, `skipToNextItem`, `skipToPreviousItem`, `stop`, `unauthorize`, `unmute`.

That gives us, and only us:

| Operation | Documented v3 API | Verdict |
|---|---|---|
| Replace whole queue | `setQueue(QueueOptions)` | supported |
| Append | `playLater` — *"Inserts the MediaItem(s) defined by QueueOptions after the last MediaItem in the current queue."* | supported |
| Insert next | `playNext` | supported |
| Clear | `clearQueue` | supported |
| Jump to index | `changeToMediaAtIndex` / `playAt` | supported |
| **Remove one arbitrary item** | — | **absent** |
| **Reorder / move** | — | **absent** |

`QueueOptions` content selectors are documented as exactly four type pairs — `album`/`albums`, `musicVideo`/`musicVideos`, `playlist`/`playlists`, `song`/`songs` — plus `url`, and the playback options `repeatMode`, `startPlaying`, `startTime`. No index or position parameter exists on any of them.

**Confidence: `VERIFIED-docs`** for "the documented v3 API supports replace / append / insert-next / clear / jump, and does not support arbitrary remove or reorder."

### Sub-finding — undocumented runtime methods exist. Do not build on them.

The shipped `https://js-cdn.music.apple.com/musickit/v3/musickit.js` (Apple-published, minified, 615 KB) contains a `Queue` class with methods that are **absent from the reference**: `splice(start, deleteCount, items = [])`, `append(items)`, `updateItems(items)`, `removeQueueItems(predicate)`, `indexForItem`, `item(index)`, `clearAfterCurrent()`, `clear()` — and `remove(index)`, which is explicitly self-deprecating:

```js
remove(e){ if(deprecationWarning("remove",{message:"The queue remove function has been deprecated"}),
            e===this.position) throw new MKError(MKError.Reason.INVALID_ARGUMENTS);
           this.splice(e,1) }
```

`splice` does publish `queueModified` and `queueItemsDidChange`, so a splice would at least propagate to listeners. **There is no `reorder` or `move` method** — a reorder would have to be emulated as splice-out plus splice-in, or as a whole-array `updateItems()`.

**Confidence on this sub-finding: `LIKELY`** that these methods function as their names suggest — the evidence is Apple's own shipped code, which is a real primary source, but it is *minified implementation, not documentation*, one of the two methods carries an explicit deprecation warning, and none of it is contractual. Apple can delete any of it in a v3 point release with no changelog.

**`supports("queueRemove")` and `supports("queueReorder")` must be `false`.** 001 §14.4's first rule — *"Never invent parity. No shim may make `supports()` return `true` for something the provider cannot do"* — plus §14.0's posture, both point the same way: an undocumented, partly-deprecated method is not a capability. If we ever want it, it needs a runtime feature-probe and a fallback, and that is a separate decision, not this spike's.

---

## Row 20 — Is there a public API for starting a station SEEDED FROM A SPECIFIC TRACK?

**Question.** Can we do the in-app "start a station from this song" from a browser?

**Finding — the mechanism exists and is documented; the semantics are not.** Two documented halves:

1. **A song has a station.** The `Songs` resource's `Relationships` dictionary documents exactly seven relationships — `albums`, `artists`, `composers`, `genres`, `library`, `music-videos`, and **`station`**:
   > **"station — The station associated with the song. By default, `station` is not included. Fetch limits: None"**
   > — https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary

   It is reachable at `GET https://api.music.apple.com/v1/catalog/{storefront}/songs/{id}/{relationship}` (https://developer.apple.com/documentation/applemusicapi/fetch-a-relationship-on-this-resource-by-name-56rq7), or inline via `?include=station`.

2. **A station identifier plays.** MusicKit on the Web documents playback from a bare `ra.*` identifier:
   ```js
   const music = MusicKit.getInstance();
   await music.setQueue({ station: 'ra.985496511' });
   await music.play();
   ```
   — *Playing Catalog Stations*, https://js-cdn.music.apple.com/musickit/v3/docs/?path=/docs/getting-started-playing-apple-music-stations-catalog-stations--page

So the two-call path **song → its station → `setQueue({station})`** is fully documented end to end. `VERIFIED-docs` for that.

**What is NOT documented is what that station actually is.** Apple's entire description is five words: *"The station associated with the song."* It does not say the station is *seeded from* the track, does not say it is personalised, and does not say it differs from the artist's station or a genre station. The same `station` relationship name also exists on `Artists`, which is a hint that "associated station" may be a coarser association than the "Create Station" behaviour in the Apple Music app.

**Confidence: `LIKELY` (supported).** What implies it: the relationship is per-*song*, it is `Fetch limits: None` (a single object, not a list), and it returns a `ra.*` station id of the same shape that `setQueue({station})` accepts. What is missing: any statement that the station is track-seeded rather than track-*adjacent*.

**What would settle it** (cannot be done under H-2): `GET https://api.music.apple.com/v1/catalog/us/songs/{songId}/station` with `Authorization: Bearer <signed developer token>` — **no music-user-token needed, this is catalog data**, so a developer token alone settles it. Run it against three songs by three different artists and read `data[0].attributes.name` and `.editorialNotes`. If the names come back distinct and song-shaped (e.g. `"<Song> Station"`), it is a seeded station and row 20 upgrades to `VERIFIED-docs`-adjacent. If the same artist's songs all return one identical `ra.*` id, it is an artist station and row 20 resolves as **not** track-seeded.

**Until that call is made, `supports("stationSeedFromTrack")` is `false`.** `supports("stations")` is separately `true` — catalog, personal and live-radio station playback are all documented (`filter[identity]=personal`, `filter[featured]=apple-music-live-radio`).

---

## Row 21 — Is there a lyrics endpoint? What entitlement does third-party DISPLAY require? Are lyrics time-synced?

### 21a — Is there a public lyrics endpoint?

**Finding. No.** Apple publishes a *flag* saying lyrics exist and no way to fetch them. `Songs.Attributes` documents:

> **"hasLyrics — Indicates whether the song has lyrics available in the Apple Music catalog. If `true`, the song has lyrics available; otherwise, it doesn't."**
> — https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary

The full documented `Songs` attribute set is `albumName`, `artistName`, `artistUrl`, `artwork`, `attribution`, `audioVariants`, `composerName`, `contentRating`, `discNumber`, `durationInMillis`, `editorialNotes`, `genreNames`, **`hasLyrics`**, `inFavorites`, `isAppleDigitalMaster`, `isrc`, `movementCount`, `movementName`, `movementNumber`, `name`, `playParams`, `previews`, `releaseDate`, `trackNumber`, `url`, `workName`. **No lyrics content field.** The seven documented `Songs` relationships (row 20) contain no lyrics relationship. There is no lyrics endpoint anywhere in the Apple Music API endpoint index, and the word "lyric" does not appear in the MusicKit on the Web v3 reference at all. It does not appear in the Apple Music Feed API either (https://developer.apple.com/documentation/applemusicfeed).

**Confidence: `VERIFIED-docs`** — no public lyrics endpoint exists. 001 §14.3 row 21's premise that `/v1/catalog/{sf}/songs/{id}/lyrics` "exists" is **not supported by any Apple documentation**; that URL appears only in third-party reverse-engineering work.

**Sub-finding, named as the dispatch requires.** An undocumented `/v1/catalog/{sf}/songs/{id}/lyrics` and a word-synced `/syllable-lyrics` variant are widely described by third parties as the endpoints Apple's own web player uses, requiring a `Media-User-Token` header and a *privileged* developer token that ordinary developer keys do not carry. **Named sources, all third-party, `LIKELY` at absolute best and unusable regardless:** `rryam/MusanovaKit` (https://github.com/rryam/MusanovaKit — self-described as "Explore and experiment with private Apple Music API endpoints"), and `binimum/apple-music-web-components` (https://github.com/binimum/apple-music-web-components). Both are explicitly private-API projects. Building on them would be undocumented, unentitled, breakable without notice, and plausibly a terms violation. **Not a capability.**

One corroborating oddity worth recording: Apple's shipped `musickit.js` v3 does contain lyric identifiers — `lyricsPlay`, `lyricsStop`, `LYRIC_DISPLAY`, `lyric-id`, `lyric-language` — but every one of them is inside the **analytics/metrics field schema**, i.e. MusicKit's telemetry payload shares an event vocabulary with Apple's first-party clients. There is no fetch, no render, no accessor. This is evidence *against* a usable third-party path, not for one.

### 21b — What entitlement does third-party display require?

**Finding: `UNVERIFIED`.** Apple publishes no entitlement, no capability, no program, and no terms clause that grants a third party the right to display Apple Music lyrics. The absence is total: there is nothing in the Apple Music API docs, the MusicKit web docs, or the Apple Music Feed docs to read either way. I will not guess at a licensing posture.

**What would settle it:** nothing callable. This is a business/licensing question, not an API question — it takes a written answer from Apple Developer Technical Support or an Apple Music partnership contact. **Do not schedule engineering against it.**

### 21c — Are lyrics time-synced?

**Finding: `UNVERIFIED`, and moot.** There is no public endpoint to return lyrics in any form, so there is no public statement about whether they carry timing. The third-party reports of a `syllable-lyrics` endpoint imply word-level sync in Apple's *private* API, which tells us nothing about a hypothetical future public one.

**What would settle it:** the same non-existent public endpoint. Nothing to call.

**Row 21 headline label: `VERIFIED-docs` that no public lyrics endpoint exists. `supports("lyrics")` and `supports("lyricsSynced")` are both `false`, and this is not expected to change on a schedule we control.**

---

## Row 30 — Is offline audio (download-for-offline) available to a browser client at all?

**Question.** Can a browser client download Apple Music audio for offline playback?

**Finding. No documented path exists, on either half of the stack.**

- **MusicKit on the Web v3 reference:** zero occurrences of "offline", zero of "download", zero of "cache", zero of "persist". The documented surface is a streaming player — `setQueue` fetches, `play` streams. There is no asset accessor, no download method, no persistence API, and no `MediaKeySession` control.
- **Apple Music API:** no downloads endpoint in the endpoint index. `Songs.Attributes.previews` exposes only *"The preview assets for the song"* — the 30-second clips, not the full asset.
- **Playback is DRM-gated**, which is the structural reason offline is not on the table. Apple documents a `drmUnsupported` event:
  > **"A notification for indicating that media playback has fallen back to preview mode due to an inability to configure DRM for the current item in the current environment."**
  > — *Reference › JavaScript › Events*, https://js-cdn.music.apple.com/musickit/v3/docs/?path=/docs/reference-javascript-events--page

  and the error index includes `WIDEVINE_CDM_EXPIRED`, confirming EME/CDM dependency. `previewOnly` is documented as the *only* non-DRM asset path:
  > "If the app does not have user authorization, then playback is restricted to non-DRM preview assets, which are snippets of the full media."

**Confidence: `VERIFIED-docs`** — MusicKit on the Web and the Apple Music API document no download or offline-audio capability of any kind.

**Sub-finding, `LIKELY`:** no undocumented path exists either. Offline EME playback would require a `persistent-license` `MediaKeySession`, which requires Apple's license server to issue persistent licenses; nothing in the docs offers one. Corroborating, from Apple's shipped `musickit.js` v3: the analytics schema's `offline` field is hardcoded — `createFieldFn("offline",()=>!1)` — MusicKit on the Web always reports `offline: false` to Apple. That is minified implementation, hence `LIKELY`, not `VERIFIED-docs`.

**What would settle the residual:** attempt `navigator.requestMediaKeySystemAccess(..., [{ sessionTypes: ['persistent-license'] }])` against MusicKit's configured key system and try to persist a license for a real track — which needs a signed developer token and an authorised subscriber, so it is out of scope under H-2. **I do not recommend spending the token on it. The documented answer is clear enough to plan against.**

**001 §5.1 row 10's existing assumption — a Service Worker cache of shell, artwork and metadata, never audio — is correct and should be treated as settled.**

---

## Bonus finding (outside the six rows, but it firms up the table)

**001 §14.3 row 7 — library remove on Apple — was labelled `LIKELY` (not supported). It is now `VERIFIED-docs` (not supported).** The same exhaustive endpoint enumeration applies: `POST /v1/me/library` adds, and there is no corresponding removal endpoint; the only `DELETE`s in the API are ratings. Apple staff, Dec 2020, name it explicitly: *"…including deleting tracks from the user's library"* as a thing developers want and cannot have (https://developer.apple.com/forums/thread/107807). §14.3's posture for row 7 — **(c) hide on Apple** — stands, and can now be built without a caveat.

---

## CONSEQUENCES

What changes in the 001 surfaces, per row, now that these have resolved.

### Rows 10 + 11 — playlist remove and reorder are unimplementable on the launch provider

This is the resolution 001 feared, and it lands on the unfavourable side.

| Surface | Change |
|---|---|
| **`pod-edit-playlist` (§7.2)** | Registers on Apple with **`remove` and `reorder` absent from its `inputSchema` entirely**, and a `description` stating it can only add. This is exactly the "partially supported → the schema narrows" rule in §14.6, and that rule's conditional ("if rows 10–11 confirm as unsupported") is now unconditional for Apple. The agent cannot express an operation the provider cannot perform. |
| **S08 Album → Tracks, staged diff (§8.5)** | The staged diff shows **`+` rows only**. No `−` rows, no move indicators. The diff component must be built so the additive-only variant is its natural shape, not a crippled version of a three-verb one. |
| **Drag handles** | **Do not render** on any Apple playlist surface. Per §14.4, hide — never render disabled. The row's action sheet loses its `Remove from Playlist` item entirely on Apple. |
| **Undo / the Engraving (B07)** | A playlist add is **not undoable on Apple**, because undo would require removal. §8.5's two-press confirm carries the whole safety burden for playlist writes on Apple; there is no post-hoc `⟲`. **This needs a copy decision** — the `⟲` affordance must not render on Apple playlist-add entries, and B07 should not imply an undo it cannot perform. |
| **B04 / S27 `unsupportedReason()`** | Needs a string. Suggested, in §11.0 voice: `Apple Music only lets other apps add to a playlist.` |
| **Copy** | §11.4's destructive-action deck should be checked for any playlist-removal string; on Apple those paths do not exist. |

**The staged-diff screen does lose half its purpose on the launch provider, exactly as 001 predicted.** It retains full value for queue staging and for Spotify. Worth telling the designer before S08 is drawn.

### Row 18 — queue remove and reorder unavailable in the documented API

§14.3 row 18 assumed Apple *might* be the good case here and Spotify the bad one. **Both are bad in the documented surface.**

| Surface | Change |
|---|---|
| **S17 Up Next (priority 8)** | Its drag handles and swipe-to-remove **do not render on Apple either**. S17 is a read-only Up Next with append, clear, and jump-to-index on *both* providers. §14.3 row 18's note — *"Design it so the read-only variant is not a broken-looking version of the full one"* — is now the **only** variant, which is simpler for design, not harder. |
| **`pod-queue-reorder`** | **Not registered on Apple.** §14.6's list of tools unregistered on Spotify must be extended: `pod-queue-reorder` is unregistered on both. |
| **`pod-queue-clear`** | **Still registers on Apple** — `clearQueue` is documented. It stays Spotify-only-unregistered. |
| **Retained on Apple** | `playNext` (insert-next), `playLater` (append), `setQueue` (replace), `changeToMediaAtIndex` (jump). S17 keeps tap-to-jump and append. |

### Row 20 — station-from-track is `LIKELY` but unproven

No surface changes *yet*, and none should be planned on it. `Start Station` stays out of the action sheet until the one-call check in row 20 is run. If it fails: §14.3 row 20's stated consequence applies — the action-sheet item `Start Station` disappears on both providers, and S18 becomes curated stations only. **S18 keeps its catalog/live/personal station rows either way**, since those are `VERIFIED-docs`.

### Row 21 — lyrics resolve unfavourably

| Surface | Change |
|---|---|
| **S16 Lyrics** | **Cut, or reduced to an honest empty state, on Apple as well as Spotify.** §14.3 row 21 planned a **(d) refuse** posture for Spotify only; it now applies to both. If S16 survives at all it is as a single line — suggested: `Apple Music doesn't offer lyrics to other apps.` |
| **Now Playing centre-cycle** | **Drops from four stops to three on both providers.** This is the exact consequence §14.3 named, and it now has no provider on which the fourth stop exists. §4.3's centre-button cycle spec, S13's state matrix (§10.1), and §11.8's accessibility strings for the cycle all need the four→three edit. |
| **`pod-get-lyrics`** | **Not registered on any provider.** It should be considered for deletion from the §7.2 roster of 18 tools rather than carried as a permanently-unregistered entry — **that is a PM call, flagged not taken.** |
| **`hasLyrics`** | We can still *know* a song has lyrics. **Do not surface this.** A flag that says "lyrics exist and you can't see them" is precisely the disabled-control anti-pattern §14.4 forbids. |

### Row 30 — offline audio unavailable

| Surface | Change |
|---|---|
| **J6b `Play downloads`** | **Cut.** |
| **The `⤓` glyph** | **Cut everywhere.** |
| **`DISCONNECTED`** | Becomes **browse-cached-metadata-only** across every screen that has the state. |
| **Copy on five screens** | §14.3 row 30's "changes copy on five screens" is now due. The `DISCONNECTED` strings in §11.5 and §11.6 must promise metadata and artwork only, never playback. Resolve **before S13 and S17 are built**, as 001 instructed. |
| **What survives** | The Service Worker cache of **shell, artwork and metadata** is unaffected and remains the right design. |

---

## Apple `supports()` matrix — ready to paste into `packages/providers`

Every unresolved row is `false`. **A capability is absent until proven present.** Capability names are exactly those in the 001 §14.2 `Capability` union.

```ts
// Apple Music — capability matrix. Source: docs/workstreams/002-implementation-spine/
// evidence/apple-capability-spike.md (S1, docs-only, no authenticated call made).
// Rule: unresolved => false.
const APPLE_SUPPORTS: Record<Capability, boolean> = {
  // ── Resolved FALSE by this spike ────────────────────────────────────────
  playlistRemoveTracks:  false, // row 10 · VERIFIED-docs · no endpoint exists
  playlistReorder:       false, // row 11 · VERIFIED-docs · no positional write exists
  queueRemove:           false, // row 18 · VERIFIED-docs · undocumented + deprecated only
  queueReorder:          false, // row 18 · VERIFIED-docs · no such method, documented or not
  stationSeedFromTrack:  false, // row 20 · LIKELY supported, UNPROVEN -> false
  lyrics:                false, // row 21 · VERIFIED-docs · no public endpoint
  lyricsSynced:          false, // row 21 · UNVERIFIED · moot while `lyrics` is false
  libraryRemove:         false, // row 7 (bonus) · VERIFIED-docs · upgraded from LIKELY
  ratingStars:           false, // row 22 · not a provider capability; local-only (§14.3)

  // ── Confirmed TRUE while I was in the docs ──────────────────────────────
  playlistCreate:        true,  // POST /v1/me/library/playlists
  playlistAddTracks:     true,  // POST /v1/me/library/playlists/{id}/tracks (appends to END)
  libraryAdd:            true,  // POST /v1/me/library
  queueAppend:           true,  // MusicKit v3 playLater()
  queueInsertNext:       true,  // MusicKit v3 playNext()
  queueRead:             true,  // MusicKit v3 Queue.items / .position / .length
  stations:              true,  // setQueue({station:'ra.*'}); catalog + personal + live radio

  // ── Not re-examined by S1; carried from 001 §14.3 unchanged ─────────────
  auth: true, search: true, libraryRead: true,
  transport: true, seek: true, volume: true,
  ratingLoveDislike: true, saveToggle: true,
  progressTicks: true, artworkArbitrarySize: true,
};
```

**Two notes for whoever wires this up.**

1. **`offline` is not a member of the §14.2 `Capability` union.** Row 30 therefore has no `supports()` key to be `false` in. Either add `"offline"` to the union and set it `false` for both providers, or record the decision that offline audio is out of scope product-wide and never a capability. **Flagged, not decided — it is a PM call.** I have not edited §14.2.
2. **`playlistAddTracks: true` carries a positional constraint that `supports()` cannot express.** Apple appends to the end, always. Anywhere the UI or a WebMCP tool implies an insertion point within a playlist, it will be wrong on Apple. The `pod-edit-playlist` schema narrowing described above is the mitigation.
