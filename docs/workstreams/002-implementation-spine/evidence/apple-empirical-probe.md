# Apple Music empirical probe — S2

**2026-08-28 · read-only, developer token only · follows S1 (docs-only), D-016, D-017, D-022, D-024, D-025**

---

## Headline, first lines, as required

**Row 20 — SUPPORTED. `VERIFIED · live`.** A song's `station` relationship **is** seeded from that specific song. The station id is literally derived from the song's own catalog id (`song 651880159` → `ra.651880159`), the station is named after the song (*"The Chain Station"*), and it is a **different resource** from that artist's station (`ra.158038`, *"Fleetwood Mac & Similar Artists Station"*). Measured across three artists × two songs each. **`supports("stationSeedFromTrack")` flips `false` → `true`.**

**Row 21 — ⚠ S1 IS FALSIFIED, and 001 §14.3 was right all along.** `GET /v1/catalog/us/songs/{id}/lyrics` returns **`400`**, and the body is **not** "no such relationship" — it is **`"Insufficient Permissions"`, code `40012`, `"'lyrics' entities require permissions that are not in the request"`**. The endpoint **exists**. It is permission-gated, not absent. The nonsense control on the same song returns a **different** code (`40008`, *"No relationship found matching…"*), which is what makes this decisive rather than suggestive.

**S2.4 — ⚠ S1's exhaustive-enumeration premise is FALSIFIED by counterexample.** `Songs` carries **at least three relationships that are not in S1's "complete" documented set of seven** — `lyrics`, `syllable-lyrics` and `credits`, all three confirmed live. The documented surface is **strictly smaller** than the real surface, so "Apple documents no endpoint for X" no longer entails "no endpoint for X exists."

**No write was attempted. No user token was obtained. `authorize()` was never called. Nothing in the owner's library was read, created, modified or deleted.** D-018's authorisation remains uninvoked.

---

## Labels — two axes, per D-022

Every finding carries **evidential strength** × **provenance**. `live` is the axis that closes a row.

| | `docs` | `live` |
|---|---|---|
| **`VERIFIED`** | Apple's docs state it plainly | **demonstrated against the running API** |
| **`LIKELY`** | strongly implied | observed, but the observation admits more than one reading |
| **`UNVERIFIED`** | not established | not reachable by any call available to us |

**Not inflated.** A 404 on one endpoint is not proof a capability is absent, and nothing below claims that. Where an observation is consistent with more than one explanation, it is labelled `LIKELY · live` and the alternatives are named.

---

## Method

Twenty-two `GET` requests to `api.music.apple.com`, 350–400 ms apart, across two runs. Every request carried a **developer token only**. None touched `/v1/me/`. `assertReadOnly()` in the probe script throws on any non-`GET` method and on any `/v1/me/` path, so this is a property of the code rather than of my intentions.

Credentials: `APPLE_TEAM_ID` from `.env.local` (gitignored, auto-loaded by Bun), key path from `APPLE_MUSICKIT_KEY_PATH`. The token was never printed, written to a file, or included below; `redact()` scrubs both the live token and any JWT-shaped string from every output line. The key is read only inside the signing call, imported non-extractable, and the decoded DER is zeroed in a `finally`.

---

## F1 — Row 20: the song `station` relationship IS track-seeded · `VERIFIED · live`

**Requests.** `GET /v1/catalog/us/songs/{id}/station` for six songs, plus `GET /v1/catalog/us/artists/{id}/station` for each of the three artists as the control. All nine returned **`200`**.

| Artist | Song (id) | Station id | Station name |
|---|---|---|---|
| Fleetwood Mac | The Chain (`651880159`) | **`ra.651880159`** | The Chain Station |
| Fleetwood Mac | Rhiannon (`202271847`) | **`ra.202271847`** | Rhiannon Station |
| Fleetwood Mac | — *artist `158038`* | **`ra.158038`** | Fleetwood Mac & Similar Artists Station |
| Kendrick Lamar | HUMBLE. (`1440882165`) | **`ra.1440882165`** | HUMBLE. Station |
| Kendrick Lamar | Not Like Us (`1781353929`) | **`ra.1781353929`** | Not Like Us Station |
| Kendrick Lamar | — *artist `368183298`* | **`ra.368183298`** | Kendrick Lamar & Similar Artists Station |
| Björk | Human Behaviour (`300205497`) | **`ra.300205497`** | Human Behaviour Station |
| Björk | Army of Me (`300205685`) | **`ra.300205685`** | Army of Me Station |
| Björk | — *artist `295015`* | **`ra.295015`** | Björk & Similar Artists Station |

Verbatim response for the first (token-free; the others are identical in shape):

```json
{"data":[{"id":"ra.651880159","type":"stations","href":"/v1/catalog/us/stations/ra.651880159",
"attributes":{"isLive":false,"mediaKind":"audio","name":"The Chain Station",
"playParams":{"format":"tracks","hasDrm":false,"id":"ra.651880159","kind":"radioStation",
"mediaType":0,"stationHash":"CgkIARoF383rtgIQAQ"},
"url":"https://music.apple.com/us/station/the-chain-station/ra.651880159"}}]}
```

**Three independent measurements, all agreeing:**

1. **Within-artist (the decisive one).** Two songs by the *same* artist return **different** station ids, in all three cases. Under the artist-station hypothesis they would have been identical. That hypothesis is dead.
2. **Structural.** The station id is `ra.` + **the song's own catalog id**, every time, for all six. This is not a correlation open to interpretation — the identifier is derived from the seed track.
3. **Song-vs-artist control.** The artist's own `station` relationship returns `ra.<artistId>` under a visibly different naming convention (*"… & Similar Artists Station"*). The two relationships are different resources with different semantics. S1 correctly named `Artists.station` as the reason to doubt; measured, it is the reason to be confident.

Cross-artist distinctness — the comparison S1 proposed — was also observed, and remains **non-discriminating**, exactly as D-024 now requires such fixtures to be labelled. It is not what settles this.

**Consequence.** `supports("stationSeedFromTrack") = true`. The two-call path *song → its station → `setQueue({ station })`* is now demonstrated end to end at the data layer: the returned `playParams.kind` is `"radioStation"` and `id` is the `ra.*` value MusicKit's `setQueue({station})` accepts. `Start Station` can return to the action sheet on Apple; per 001 §14.3 row 20 it stays absent on Spotify unless separately settled. `hasDrm: false` on the station's `playParams` is noted but not interpreted here — it describes the station resource, not entitlement to stream it.

---

## F2 — Row 21: the lyrics endpoint EXISTS and is permission-gated · `VERIFIED · live`

**The three status codes the dispatch asked for, all against the same song (`651880159`):**

| # | Request | Status | Body |
|---|---|---|---|
| 1 | `GET /v1/catalog/us/songs/651880159/artists` *(known-good control)* | **`200`** | `{"data":[{"id":"158038","type":"artists",…}]}` |
| 2 | `GET /v1/catalog/us/songs/651880159/zzz-not-a-relationship` *(nonsense control)* | **`400`** | `{"errors":[{"id":"OFYVL4PF74FJ3XXH7I5JM6AN6E","title":"Invalid Path Value","detail":"No relationship found matching 'zzz-not-a-relationship'","status":"400","code":"40008"}]}` |
| 3 | **`GET /v1/catalog/us/songs/651880159/lyrics`** | **`400`** | `{"errors":[{"id":"EIKENIRM4PE5KBGNT7HOBPTBGU","title":"Insufficient Permissions","detail":"'lyrics' entities require permissions that are not in the request","status":"400","code":"40012"}]}` |
| 4 | `GET /v1/catalog/us/songs/651880159/syllable-lyrics` | **`400`** | `{"errors":[{"id":"CW22JDKX6SGJ6SUBGXDWGD4OXM","title":"Insufficient Permissions","detail":"'syllable-lyrics' entities require permissions that are not in the request","status":"400","code":"40012"}]}` |

**The controls are the whole finding.** Both #2 and #3 are `400`, so a status code alone would have been worthless — which is precisely why the calibration was added. Apple's server distinguishes them by **title and code**:

- `40008 · Invalid Path Value · "No relationship found matching X"` — **the name is not a relationship.**
- `40012 · Insufficient Permissions · "'X' entities require permissions that are not in the request"` — **the name IS a relationship; the caller lacks permission.**

`/lyrics` lands in the second category. **Apple's own routing layer recognises `lyrics` as a real entity on `Songs`.**

**What this overturns.**

- **S1's Row 21a — *"Finding. No. …no public lyrics endpoint exists," `VERIFIED-docs`* — is falsified.** The endpoint exists. S1's error was not carelessness: it read the documentation correctly. The documentation is incomplete. That is the S2.4 finding, and Row 21 is its sharpest instance.
- **001 §14.3 row 21's premise that `/v1/catalog/{sf}/songs/{id}/lyrics` "exists" is CORRECT.** D-015 flagged this as *"⚠ 001 §14.3 states the lyrics endpoint 'exists'. S1 found it in no Apple documentation … if it holds, 001 §14.3 row 21 is factually wrong and every downstream lyrics decision rests on a phantom."* **It does not hold. 001 was right and the phantom warning should be withdrawn.** The `⚠ DEVIATES` marker on that line needs removing.
- **The third-party reports were accurate about existence.** `MusanovaKit` and others named both `/lyrics` and a syllable-level variant; both are confirmed real. This does **not** make them safe to build on — see below.

**What it does NOT establish, and I will not claim it does.** The word `permissions` in Apple's error is ambiguous between at least two readings:

- **(a)** the request lacks a `Media-User-Token` (i.e. any authenticated subscriber could read it), or
- **(b)** the *developer token itself* must carry a privileged entitlement ordinary MusicKit keys do not have.

**Nothing in this response distinguishes them**, and no read available to me does either. Testing (a) requires a user token, which is outside the boundary and which I did not obtain. And even a `200` under (a) would not answer the question that actually matters.

**Row 21b is unchanged and remains the real blocker: `UNVERIFIED · docs`.** Whether a third party may lawfully *display* Apple Music lyrics is a licensing question. No status code resolves it; it needs Apple in writing.

**But the ask to Apple has changed, and that is worth something.** S1's conclusion pointed at nothing — "there is no endpoint, do not schedule engineering." The correct question is now concrete and answerable: **"`lyrics` and `syllable-lyrics` return `40012`; what entitlement grants that permission, and is it available to us?"** That is a question DTS can actually answer. Recommend raising it.

**`supports("lyrics")` stays `false`, and `supports("lyricsSynced")` stays `false`.** A capability gated behind an entitlement we do not hold is not a capability (001 §14.4: never invent parity). The *product* outcome for S16 and the Now Playing centre-cycle is unchanged; only the reason changed, from "impossible" to "not entitled — ask." Do not soften the UI on the strength of this. **Do not build against the private path**: `40012` is Apple explicitly declining the request, and routing around it would be an entitlement violation, not a workaround.

**Row 21c — time-synced lyrics: `LIKELY · live` that a syllable-level variant exists.** `syllable-lyrics` is confirmed a real gated entity, and syllable-level timing is the only sensible reading of the name. But we have never seen a response body, so the *content* format remains `UNVERIFIED`. Moot while 21b is unresolved.

---

## F3 — S2.4: the documented surface is NOT the real surface · `VERIFIED · live`

This is the joint the reviewer was pointed at, and it broke.

**The angle that did not work, reported honestly.** I expected Apple to enumerate legal values when fed invalid ones. It does not — invalid query parameters are **silently ignored**:

| Request | Status | Result |
|---|---|---|
| `GET /v1/catalog/us/songs/651880159?include=zzz-bogus` | **`200`** | full song resource, no error, no warning |
| `GET /v1/catalog/us/songs/651880159?views=zzz-bogus` | **`200`** | full song resource, no error, no warning |
| `GET /v1/catalog/us/songs/651880159?extend=zzz-bogus` | **`200`** | full song resource, no error, no warning |
| `GET /v1/catalog/us/zzz-bogus-resources/651880159` | **`400`** | `{"errors":[{"id":"WOOP54L2ANMR4YGTRIOHFVHP7Y","title":"Invalid Path Value","detail":"Unknown catalog resource type 'zzz-bogus-resources'","status":"400","code":"40008"}]}` |

Worth recording as a hazard in its own right: **a typo'd `include`/`extend` fails silently with a `200`.** Any adapter relying on `?include=station` will simply receive a response without the relationship rather than an error. That belongs in the Apple adapter's tests.

**The angle that did work — a relationship existence oracle.** The *path* form is strict where the query form is lax, and it returns four distinguishable outcomes:

| Outcome | Meaning |
|---|---|
| `200` | relationship exists, has data |
| `404` · `40403` · *"No related resources found for X"* | **relationship exists**, no data for this resource |
| `400` · `40012` · *"'X' entities require permissions…"* | **relationship exists**, permission-gated |
| `400` · `40008` · *"No relationship found matching 'X'"* | **not a relationship at all** |

That is a live, authoritative oracle for "does this relationship exist?", entirely independent of the documentation. Run against `Songs`:

| Name | In S1's documented set of 7? | Status | Code | Verdict |
|---|---|---|---|---|
| `artists` | yes | `200` | — | exists |
| `station` | yes | `200` | — | exists |
| **`lyrics`** | **no** | `400` | `40012` | **EXISTS, gated** |
| **`syllable-lyrics`** | **no** | `400` | `40012` | **EXISTS, gated** |
| **`credits`** | **no** | `404` | `40403` | **EXISTS** (*"No related resources found for credits"*) |
| `similar-songs` | no | `400` | `40008` | not a relationship |
| `radio` | no | `400` | `40008` | not a relationship |
| `videos` | no | `400` | `40008` | not a relationship |
| `zzz-not-a-relationship` | no | `400` | `40008` | not a relationship *(control)* |

**Three counterexamples.** S1 stated the `Songs` `Relationships` dictionary "documents exactly seven relationships" and used that closure as the evidentiary basis for its negatives. The live surface has at least ten. The negative controls returning `40008` confirm the oracle discriminates rather than saying "exists" to everything.

**`credits` deserves separate note.** It is a genuine undocumented relationship that is *not* permission-gated — it returned `40403` (recognised, no data for this particular song), not `40012`. So the documentation gap is not merely "private entitled endpoints are hidden"; ordinary relationships are missing from it too.

**What this does and does not do to S1's negative rows.**

It **does** invalidate the *general inference rule* S1 relied on — "the documented set is exhaustive, therefore absence from it proves absence." That rule is now known to be unsound on this API, and S1 flagged it as its own weakest point. Its instinct was right.

It does **not** show that playlist removal exists. Rows 10, 11 and 18 have a **second, independent** evidentiary leg that Row 21 never had: repeated, explicit, on-the-record Apple staff statements across six years that adding is all the API supports, plus the affirmative *"Add new tracks to the **end** of a library playlist"* phrasing. That leg is untouched by this finding.

**Recommendation: downgrade the negatives' label from `VERIFIED · docs` to `LIKELY · docs`** — the enumeration half of the argument no longer carries `VERIFIED`, and the staff-statement half was always corroboration rather than documentation (S1's own rule, §"Apple Developer Forums replies are treated as corroboration, never as the primary source"). **No `supports()` value changes**, because all three are already `false` and a capability is absent until proven present. This is a change in stated confidence, not in behaviour — but the difference matters if anyone later re-opens `pod-edit-playlist` on the strength of "we verified this."

**The write surface cannot be enumerated by this oracle.** It only works on `GET` relationship paths; `/v1/me/library/**` requires a user token and settling rows 10/11 requires an actual mutation. Unchanged, and I am still not asking.

---

## F4 — Supporting live findings

**`api.music.apple.com` authenticates before it routes · `VERIFIED · live`.** Five unauthenticated `GET`s — real paths and fabricated ones alike — all returned a bare **`401`**, `content-length: 0`, no `WWW-Authenticate`, no `errors[]` envelope. The route surface cannot be enumerated anonymously, and it is only because auth is evaluated first that F2's and F3's authenticated status codes are statements about routing rather than about credentials.

**Token minting is correct · `VERIFIED · live`.** ES256 over P-256 via WebCrypto, no JWT dependency: header `{alg, kid, typ}` with a 10-char `kid` derived from the key filename, claims `{iss, iat, exp}`, and a **64-byte raw `r‖s`** signature (not DER — the usual failure). Credential sanity check `GET /v1/catalog/us/songs/651880159` → **`200`**. The earlier blocker (`H-11`) is closed.

**A wrong `iss` is rejected opaquely · `VERIFIED · live`.** Before the Team ID arrived, a well-formed token with `iss = "AAAAAAAAAA"` returned `401` with an empty body. Apple validates the team claim, and wrong-team / revoked-key / wrong-key-type are indistinguishable. Retained because it tells the adapter that **a `401` here is never diagnosable from the response** — it must be surfaced as a configuration error, never retried.

---

## Row-by-row state after S2

| Row | S1 | **S2** | Label (strength · provenance) |
|---|---|---|---|
| **20** — station seeded from track | `LIKELY` supported, unproven | **SUPPORTED — track-seeded, id is `ra.<songId>`** | **`VERIFIED · live`** |
| **21a** — public lyrics endpoint | `VERIFIED-docs` **none exists** | **⚠ FALSIFIED — exists, `40012` permission-gated** | **`VERIFIED · live`** |
| **21b** — display entitlement | `UNVERIFIED` | unchanged; the *question to ask Apple* is now concrete | `UNVERIFIED · docs` |
| **21c** — time-synced | `UNVERIFIED`, moot | `syllable-lyrics` exists and is gated; content format unseen | `LIKELY · live` (existence) |
| **10 / 11** — playlist remove / reorder | `VERIFIED-docs` not supported | not probed (needs a write); **enumeration leg weakened** | `LIKELY · docs` |
| **18** — queue splice / reorder | `VERIFIED-docs` not supported | not probed | `LIKELY · docs` |
| **7** — library remove | `VERIFIED-docs` not supported | not probed; same weakened leg | `LIKELY · docs` |
| **30** — offline audio | `VERIFIED-docs` not supported | not probed | unchanged |
| **S2.4** — "documented == real" | asserted | **⚠ FALSIFIED — ≥3 undocumented `Songs` relationships** | **`VERIFIED · live`** |

### Changes to S1's `APPLE_SUPPORTS` matrix

**Exactly one value moves.**

```ts
- stationSeedFromTrack:  false, // row 20 · LIKELY supported, UNPROVEN -> false
+ stationSeedFromTrack:  true,  // row 20 · VERIFIED-live · station id is ra.<songId>;
+                               // distinct per song within one artist; != artists/{id}/station
```

Everything else holds:

- `lyrics: false` and `lyricsSynced: false` — **the reason changes, the value does not.** Endpoint exists but returns `40012` to our token; gated behind an entitlement we do not hold, and 21b is unresolved. Comment should be corrected from *"no public endpoint"* to *"exists, `40012` Insufficient Permissions; entitlement unresolved (21b)"* so nobody re-derives the wrong conclusion from a stale comment.
- `playlistRemoveTracks`, `playlistReorder`, `queueRemove`, `queueReorder`, `libraryRemove` — `false`, unchanged. Confidence downgraded to `LIKELY · docs`; behaviour identical.

**Downstream, from 001 §14.3 row 20:** `Start Station` returns to the action sheet on Apple, and S18 gains the track-seeded row. Everything S1 wrote about S16 Lyrics, the four→three centre-cycle, the staged diff, drag handles and offline stands unchanged.

---

## Reproducing

```
# APPLE_TEAM_ID is read from .env.local (gitignored, auto-loaded by Bun).
export APPLE_MUSICKIT_KEY_PATH="$PWD/cert/AuthKey_<KEYID>.p8"

bun run scripts/spikes/mint-apple-dev-token.ts   # metadata only; never prints the token
bun run scripts/spikes/probe-apple.ts            # ~22 read-only GETs, 350 ms apart
```

`probe-apple.ts` is read-only by construction: `assertReadOnly()` throws on any non-`GET` method and on any path containing `/v1/me/`. Do not relax it.
