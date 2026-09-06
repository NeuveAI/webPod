# Review: tactile collection — product behavior and physical design

## Verdict: APPROVE

### Correctness Check

- Source of truth: owner request for real collectible packs and latest palpable-material clarification; AGENTS.md; tactile-collection-scope.md including material acceptance; implementation-decisions.md; backend-contract.md; exported Pencil material study I3j07 and collection storyboards.
- Kanban ticket: none; no board exists by repository law.
- Correctness target: genre collections, five earned/locked/placed seats, accessible meanings, direct physical peel/place/return with honest progression; distinguish folded paper sleeve, release liner, laminated print and adhesive in actual rendering.
- Dispatch scope: collection data/view/controller/scene/materials and real product-route evidence. No backend earning or authentication changes authorized by this review.
- Dependency/HITL status: runtime/app source is frozen and independently verified. Owner taste remains subjective; no approval is inferred from screenshots or numeric ratings.
- Neuve HITL gate: unavailable by repository law.
- DoD checklist: final frozen types/lint, native production browser integration and actual visual/material evidence completed. Independent flick verdict is APPROVE separately.
- Review lanes: independent runtime review in tactile-runtime-review.md; broad collection takeover authorized when previous reviewer could not be resumed under tool limit. Lead does not implement or perform final review.
- Type/lint/doc gates: app TypeScript independently passed at earlier checkpoint. Final root types and scoped lint independently passed. No reviewer source edits.
- Git history/staging: separate flick, collection, and design/evidence commits remain feasible.
- Verification evidence: final independently executed tests and browser provenance are listed below. Earlier blank-art and material iterations were explicitly rejected; only captures matching the eventual accepted fingerprint are final evidence.
- Decision-log status: scope and diaries read; UI/motion/runtime skills recorded in tactile-runtime-review.md, plus fresh official Web Interface Guidelines. Approved PNG art remains immutable.
- Material authority independently checked: [Avery release-liner construction](https://www.avery.com/help/article/backing-paper-liner-paper-release-liner-info) describes a thin silicone release coating on backing paper; [Sticker Mule vinyl construction](https://www.stickermule.com/support/faq/custom-stickers/are-your-stickers-weatherproof) distinguishes vinyl, adhesive and protective laminate. These support separate visual responses, not numerical shader parameters or a claim of manufacturing simulation.

### Final verification and findings

- [MAJOR, RESOLVED] Canonical root startup intermittently stalled in bundled config evaluation. The narrow final fix adds `--configLoader runner` to the existing explicit-Bun app dev command; root env-file/cwd semantics stay unchanged. Independent actual root/app suite passed 3 tests / 2,025 assertions in 28.77 seconds: both product routes render T1, anonymous SQLite responds401, executable client modules exclude Bun/server credentials, app CSS HMR works, main-config and imported-helper changes restart correctly, and the final root renders again. Log: evidence/tactile-collection/reviewer-startup.log. Engineer separately passed six fresh root/app launches (9 tests / 6,075 assertions); no timeout increase or retry workaround was added.
- [MAJOR, RESOLVED] Inserted liner corner penetrated the sleeve face. Curl now stays flat until the entire corner support clears the lip, then smoothly rises. Independent four-test geometry suite (75,001 assertions) sweeps intermediate clearance and confirms covered vertices remain behind the pocket. Reviewer rebuilt and reran native138 assertions; final sealed image has no cream diagonal and emerged liner keeps its smooth corner.

- Independent final checks: root typecheck 12/12 projects; scoped ESLint; 22 model/return/motion/paper/surface/cache tests with 152,111 assertions (reviewer-source.log); git diff --check. Native built-production browser suite independently passed 138 assertions in 14.84 seconds. Log: evidence/tactile-collection/reviewer-browser.log. Frozen source fingerprint: 5ee3af207b4b7f13d1829b88f7936ce6a99ec45e875bf435574b5b023ee298ab (374 files); client SHA256 97501f768dc225bb8a849d0df8297d630b412986f91b837e890b184b0af6b301; server SHA256 741ac8d36dd2af2b05668fe2707ac91db06c9649256752300d5a5f2c5c87f189. Native Start endpoints, HttpOnly cookies, temporary SQLite, three-genre fixture, two earned Rock stickers, one trusted-service failure, real reload/reconnect/isolation; synthetic Apple/signing only, zero browser API interception.
- No unresolved Critical or Major collection findings after the independent canonical startup gate. Approval means the implemented interaction is supported by source, tests and actual final rendering; it does not infer owner taste approval or claim photographic material fidelity.
- [MAJOR, RESOLVED] The sleeve no longer scales away. A fixed-size notched pocket stays while the liner translates; final desktop-sealed-sleeve.png and desktop-open-sheet.png visibly show separate pocket and liner, smooth curled corner and neighboring collection sleeves. Close retracts the liner first, then lowers the packet. Native test checks close/reopen, sheet reveal reset, actual edge grab during liner return and front/back admission.
- [MAJOR, RESOLVED] Partial peeling now retains stationary adhesive contact through 64 px, then smoothly catches the pointer. Both resting and peeled prints share liner bow. Final desktop-peel-curl.png and desktop-peel-adhesive-contact.png show the curled leading edge and warm unprinted underside above its exact vacated die-cut seat; off-device and landing captures continue the sequence. Deterministic surface/paper tests preserve contact and UVs.
- [MAJOR, RESOLVED] Lower-rear placement is no longer hidden behind the foreground sheet. On phones the packet lowers after detachment while the held print and device frame stay put. Independently generated mobile-lower-rear-preview.png visibly shows the print near the bottom of the actual rear before release; its pixel gate cannot pass from stale upper placement alone. Reduced-motion native touch, failure recovery, direct drop and keyboard placement all pass.
- [MAJOR, RESOLVED] Wrong-sticker keyboard/meaning confirmation now preserves only a preview matching the intended sticker ID. Two earned Rock slots in the real fixture exercise A-preview/B-confirmation and meaning action without saving A accidentally.
- [MAJOR, RESOLVED] Miss/capture-loss teleport, invisible reduced-motion carry and interrupted mobile-workspace ownership are resolved as documented in tactile-runtime-review.md.
- [MAJOR, RESOLVED] Material construction is now visible in runtime, not only the study: persistent paper pocket and rim, smooth rolled liner silhouette with shading, shaped printed vinyl and exposed adhesive during peel. The previous stair-step/intersecting backing and shrinking cover are absent. Final fixed-rig captures demonstrate those distinctions; the remaining subtle finish is recorded below rather than inflated into a claim of realism.
- [INFO] All five final mobile seats are painted, including earned art, locked silhouettes and a vacant die-cut outline. mobile-locked-meaning.png shows readable meaning, measured progress and remaining milestone at 375 px; desktop-electronic-sheet.png shows a distinct second collection. Native reload/reconnect preserves placement and separate browser identity remains isolated. Approved printed PNGs are unchanged.

### Suggestions (non-blocking)

- [MINOR] Finish remains stylized: paper fibre and wax-versus-vinyl specular separation are subtle at normal product scale. The macro study is richer than the actual shader appearance; do not present it as a screenshot of the shipped runtime. No measured manufacturing simulation is claimed.
- [MINOR] Locked artwork is intentionally subdued and small captions require attention. In desktop-electronic-sheet.png the genre subtitle touches the top of Pulse Code; a little more header-to-seat spacing would improve polish.
- [MINOR] On phones the collection counter can overlap placed device art. The pack moves clear for direct customization, but browsing could benefit from a more consistently quiet text backdrop. Neighboring packs read as colored corners rather than fully identifiable covers.
- Final quality facets from actual captures: collection identity 4/5, legibility 3/5, restraint 4/5, tactile continuity 4/5, physical material credibility 3/5. These are honest critique signals, not substitutes for the executable acceptance checks or the owner's judgment.

### Neuve Dogfood Feedback

- Commands run: none; no Neuve shell or board exists in this repository.
- Artifact refs: this review, tactile-runtime-review.md, tactile-flick-review.md and tactile-collection-scope.md.
- Kanban updates: not applicable.
- HITL gate: none emitted.
- Signal value: not applicable.
- Sticking points: previous reviewer unavailable under agent tool limit; independent takeover recorded explicitly.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.

## Packet-laminate follow-up approval

The post-delivery goal audit found that the original owner request explicitly included laminate on the packet exterior, not only the vinyl stickers. The previous matte sleeve therefore missed one literal fidelity requirement despite its earlier technical/material-construction approval. The designer's post-delivery consolidated brief recorded that gap before this bounded correction; it does not retroactively claim an earlier standalone brief.

Independent source and visual re-review now **APPROVE** the correction. `sticker-sleeve.ts` partitions the unchanged extrusion into positive-Z printed exterior, negative-Z raw interior and raw cut/bevel groups. The exterior and printed folds/neighbors use one matte protective MeshPhysicalMaterial coat; geometry, UVs, silhouette and raw-edge assignment are verified by the new responsive-scale test. No coincident coat mesh, extra light, permanent scheduler or artwork mutation was added. Existing ownership/disposal remains unchanged.

The first coat iteration was rejected as too visually subtle. The final actual 375px coat/no-coat pair shows a broad soft satin bloom on the exterior, with the raw rim remaining matte; desktop response is quieter but coherent. Final sealed/open desktop and sealed/open phone captures retain printed color/cutlines, readable detail and correct inserted liner clearance. Evidence is `evidence/tactile-pack-laminate/coated/`; the engineer's isolated `comparison-no-coat/` snapshot differs in clearcoat=0 and the inactive coat-roughness value, documented exactly in its README. No dedicated oblique packet manipulation is claimed.

Independent final native production run: **138 assertions,14.80s**, preserving all direct-pointer/touch/keyboard, failed-save, return/cancel, lower-rear visibility and persistence gates. Renderer paper/sleeve/surface/cache suites: **13 tests,154,461 assertions**; app/device typechecks and scoped lint pass, as does diff whitespace check. Logs are `evidence/tactile-pack-laminate/reviewer-browser.log` and `reviewer-source.log`. Unchanged root-startup, backend and flick gates were reused, not needlessly rerun.

Final source fingerprint: `78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e`,376 files. Client SHA256 `2e7a886a52ff7d324ae6e516b135a72cf7b8fca5720cc66e050f0752bd1600da`; server SHA256 `af4b5ee0a343dbb71719f093eeb5664ade2a0a0f8121bc7dbcf7b5225d521e65`. Material credibility remains a restrained/stylized3/5, not a claim of photorealism or owner taste approval. The explicit exterior-coat omission is resolved; small captions and other previously documented optical refinements remain nonblocking.
