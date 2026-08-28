# W1 · the review's four uncaught plants, re-run against the fix

Run 2026-08-28 at 7f90d8b. Each plant is the reviewer's own, applied with
`perl -i`, measured, then restored from a copy taken beforehand. `diff -r` against that copy is
empty at the end of this file.

| # | Plant (the reviewer's, verbatim) | before | after |
|---|---|---|---|
| 18 | `readSongRelationship(…, status = 0)` + `if (status === 200) return …data ?? []` — D-029 reintroduced | tsc:0, 230 pass 0 fail ❌ | tsc:ERR,  386 pass 0 fail  ✅ |
| 11 | `ProviderId` gains a fourth member `'tidal'` | tsc:0, 230 pass 0 fail ❌ | tsc:ERR,  386 pass 0 fail  ✅ |
| 22 | `DURATION_TOLERANCE_MS` 2000 → 500 | tsc:0, 230 pass 0 fail ❌ | tsc:0,  384 pass 2 fail  ✅ |
| 21 | `DURATION_TOLERANCE_MS` 2000 → 3000 | tsc:0, 230 pass 0 fail ❌ | tsc:0,  384 pass 2 fail  ✅ |
| 23 | `DURATION_TOLERANCE_MS` 2000 → 30000 | tsc:0, 230 pass 0 fail ❌ | tsc:0,  383 pass 3 fail  ✅ |
| 9 | `LocalKey` brand removed → plain `string` | 2 unused-directive errors of 3 claimed ❌ | 7 unused-directive errors of 7 ✅ |
```
$ diff -r <copy taken before this file ran> packages/providers
(no differences)
$ git status --short packages/providers
```

## New plants, one per finding, on the repaired code

A fix is not a fix until the defect it removes turns something red (D-050). Each row below
reintroduces the finding and reports the real result.

| Finding | Plant | Result |
|---|---|---|
| MAJOR-1 | fixture `setShuffle` accepts the mode and stores nothing | tsc 0, 383 pass 3 fail |
| MAJOR-3 | `tracksByAlbum` back to `ReadonlyMap<string, …>` | **tsc ERR**, 386 pass 0 fail |
| MAJOR-4 | `libraryList` no longer needs a session | tsc 0, 383 pass 3 fail |
| MAJOR-5 | `saveToggle` writes nothing readable | tsc 0, 385 pass 1 fail |
| MAJOR-6 | stub members drop `async` and throw synchronously | tsc 0, 281 pass 105 fail |
| MINOR-16 | `onSessionChange` silently registers and never fires | tsc 0, 384 pass 2 fail |
| MINOR-13 | a malformed cursor silently answers with page 0 | **tsc ERR**, 379 pass 7 fail |
| MINOR-14 | a JSON `null` relationship is dereferenced | **tsc ERR**, 385 pass 1 fail |
| MINOR-18 | the error discards the evidence class again | tsc 0, 385 pass 1 fail |
| MINOR-12 | a Spotify absence claim back to `VERIFIED · docs` | tsc 0, 384 pass 2 fail |
| MINOR-10 | Apple's two lyrics rows share one sentence | tsc 0, 387 pass **1 fail** |
| — | (control) delete a row's evidence label entirely | tsc 0, 387 pass **1 fail** |
| C8 | template artwork ceiling 3000 → 9000 | tsc 0, 384 pass 2 fail |
| MINOR-11 | the B04 roster stops excluding the two that hide no control | tsc 0, 383 pass 3 fail |

```
$ diff -r <copy> packages/providers && git status --short packages/providers
(no differences)
```

### Two rows in the table above were wrong when first written, and one of them found a real hole

**MINOR-10 and the control plant both reported green on the first run, and only one of those
readings was a measurement.**

- The **MINOR-10** plant used a `perl` substitution whose `\x{2019}` escape did not match the
  typographic apostrophe in the source, so **the plant never applied** and the green was the
  unmodified code passing. Re-applied with an explicit UTF-8 rewrite, it goes red. *A plant that
  silently fails to apply reads exactly like a gate that works* — which is this workstream's own
  recurring failure shape (D-038) arriving in the verification step rather than in the code. Every
  plant in this file now asserts that its own edit landed before measuring.
- The **control plant did apply, and stayed green — that was a genuine hole in the new gate.**
  Deleting a row's docblock did not leave the row unlabelled: the parser fell back to the
  *preceding* label, so the member silently inherited its neighbour's evidence class. That is worse
  than no label, because a wrong claim reads as a checked one. Closed by asserting that no two of
  the 25 members resolve to the same label occurrence, which is true by construction when every row
  carries its own. Both plants are red now.

The second one is the reason a control belongs in a plant table at all. It was aimed at the gate
rather than at the code, and it is the only row here that found something.
## Final re-review correction plants

Run 2026-08-28 from byte-isolated `git archive` copies of `9f7f16d`. Every
mutation was applied with `apply_patch`, then asserted before its focused test
ran. None touched the shared working tree.

| Finding attacked | Mutation | Proof it landed | Result |
|---|---|---|---|
| scoped search | replace `searchSource(q.scope, kind)` with `searchSource('catalog', kind)` | exact replacement found at line 452 | 2 focused tests fail: removed track, album and playlist all leak into library search |
| search cursor | replace `from = Number(q.cursor)` with `from = 0` | planted assignment found at line 457 | cursor test fails because page two repeats page one's first key |
| album membership | restore the old add/remove loops over `tracksByAlbum` | both loops found at lines 496 and 508 | album test fails: albums remain 4 instead of 3 |
| playlist count | delete both `replacePlaylistRef(id.key, next.length)` calls | zero remaining write-site calls asserted | count test fails: listed count remains 6 after seven tracks become playable |

These are behavioral gates. They do not derive expected values from the symbols
or stores being tested, and the plant results show each can reject the exact
defect class that prompted the final review.
