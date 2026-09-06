# Review: tactile collection — GPU and gesture runtime

## Verdict: APPROVE

### Correctness Check

- Source of truth: owner tactile collection and material direction; AGENTS.md; tactile-collection-scope.md; implementation-decisions.md; backend-contract.md. No global decision/platform registries exist.
- Kanban ticket: none, per repository law.
- Correctness target: shared DOM/R3F positions, continuous peel/return/landing, alpha-correct physical materials, bounded resource ownership, cancelled gesture isolation and demand settling.
- Dispatch scope: read-only runtime review of StickerPackScene, StickerSurface, sticker-contract, sticker-interaction, collection controller and shared orientation estimator; separate broad collection and flick verdicts.
- Dependency/HITL status: runtime/app source is frozen and independently verified. Owner taste is not inferred from test success.
- Neuve HITL gate: no Neuve shell or board exists by repository law.
- DoD checklist: source, deterministic lifecycle, native production browser and final material/projection evidence verified.
- Review lanes: independent bounded runtime lane, subsequently assigned flick evidence and broad collection review after earlier reviewer could not be resumed under the tool limit.
- Type/lint/doc gates: app TypeScript and flick lint independently pass; final collection types/lint independently passed. Lifecycle comments inspected; no source edits made by reviewer.
- Git history/staging: source remains separable into flick, collection runtime, and design/evidence commits; no reviewer commits.
- Verification evidence: independent 11 surface/cache/spring tests pass with 77,033 assertions. Latest independently rerun paper/model/return checks pass: 10 tests, 35,577 assertions, including separated paper surfaces, unchanged UVs, shared adhesive-tail bow, partial/free pointer transitions and return cleanup. The real-dev 12-case orientation suite independently passed in 2.0 minutes at source fingerprint 87ca93c9d7002c123d533a3e17e0b5a2c4871d8f2d186c17556a3cb73e129cb7; full scope and limitations are in tactile-flick-review.md.
- Decision-log status: scope and both engineering diaries read. Skills loaded: modern-web-guidance first (bunx search and accessibility guide), strict-critique and review protocol, global-patterns, Interface Craft storyboard/critique, all four Interface Design Guardrails resources, Neuve Motion principles/storyboard/reduced-motion, runtime-review checklist/fundamentals, Jotai guidance, React performance and fresh Web Interface Guidelines. Foreign Neuve branding and generic CSS-only animation rules do not prohibit requested Three deformation or physical light variation.

### Final verification and findings

- [MAJOR, RESOLVED] Canonical root startup intermittently stalled in bundled config evaluation. The narrow final fix adds `--configLoader runner` to the existing explicit-Bun app dev command; root env-file/cwd semantics stay unchanged. Independent actual root/app suite passed 3 tests / 2,025 assertions in 28.77 seconds: both product routes render T1, anonymous SQLite responds401, executable client modules exclude Bun/server credentials, app CSS HMR works, main-config and imported-helper changes restart correctly, and the final root renders again. Log: evidence/tactile-collection/reviewer-startup.log. Engineer separately passed six fresh root/app launches (9 tests / 6,075 assertions); no timeout increase or retry workaround was added.
- [MAJOR, RESOLVED] Inserted liner corner penetrated the sleeve face. Curl now stays flat until the entire corner support clears the lip, then smoothly rises. Independent four-test geometry suite (75,001 assertions) sweeps intermediate clearance and confirms covered vertices remain behind the pocket. Reviewer rebuilt and reran native138 assertions; final sealed image has no cream diagonal and emerged liner keeps its smooth corner.

- Independent final checks: root typecheck 12/12 projects; scoped ESLint; 22 model/return/motion/paper/surface/cache tests with 152,111 assertions (reviewer-source.log); git diff --check. Native built-production browser suite independently passed 138 assertions in 14.84 seconds. Log: evidence/tactile-collection/reviewer-browser.log. Frozen source fingerprint: 5ee3af207b4b7f13d1829b88f7936ce6a99ec45e875bf435574b5b023ee298ab (374 files); client SHA256 97501f768dc225bb8a849d0df8297d630b412986f91b837e890b184b0af6b301; server SHA256 741ac8d36dd2af2b05668fe2707ac91db06c9649256752300d5a5f2c5c87f189. Native Start endpoints, HttpOnly cookies, temporary SQLite, three-genre fixture, two earned Rock stickers, one trusted-service failure, real reload/reconnect/isolation; synthetic Apple/signing only, zero browser API interception.
- No unresolved Critical or Major runtime findings after the independent canonical startup gate. Review is bounded to the collection and flick integration; it is not a heap-profile or Safari-device certification.
- [MAJOR, RESOLVED] Reduced-motion free drag now renders whenever dragOffset exists, without bend. Final mobile-reduced-motion-free-drag.png visibly carries the actual print; the native touch flow then reaches two separate rear positions and saves.
- [MAJOR, RESOLVED] Missed drops and capture loss retain their current free offset and 97% rear blend while one return spring unwinds them. Deterministic checks verify first-frame continuity, settling, supersession, rear hiding and zero remaining frame callbacks.
- [MAJOR, RESOLVED] Mobile workspace lowering could outlive an interrupted return. resetStickerCarry in sticker-interaction.ts:36 stops the owner and restores offset/lowering/selection/preview together. Selection, switch, begin, keyboard completion, failed save and close use it. The return regression verifies interruption cleanup; native production test forces a real 503 through the trusted service seam and verifies lowered packet recovery followed by successful retry.
- [INFO] Mobile packet clearance moves only the wrapper (StickerPackScene.tsx:72–87); PeelingPrint origin at 109 remains at its pre-clearance origin. Device presentation remains tied to reveal. The same lowering enters DOM transform, so targets remain aligned. Actual mobile-lower-rear-preview.png shows Pulse Code visibly near (230,425) before release, with backing below the device.
- [INFO] Geometry ownership remains bounded. Generated stock front/back/perimeter and sleeve extrusion are explicitly disposed; JSX materials remain R3F-owned. StickerPrint borrows geometry/maps with dispose=null and explicitly disposes its own materials. Texture-cache final unsubscribe and stale completion disposal independently pass. Static 96×96 paper grids do not add a scheduler; one app rAF owner publishes Jotai state, and R3F demand invalidation settles.
- [INFO] Final cylindrical paper has separated normal-offset backing and closed perimeter; no shifted duplicate shadow meshes remain. Printed UVs and partial-peel adhesive tail contact remain stable. Locked, placed-outline and adhesive shader paths preserve sampled alpha before Three alpha testing; actual images show die-cut masks without rectangular replacement plates.
- [INFO] Installed Three 0.185.1 meshphysical.glsl.js:171–174 preserves map/alpha-test order; WebGLTextures.js:324–330 and 358 onward handles disposal. Installed R3F 9.7.0 events-156d8d12.esm.js:15185–15240 confirms dispose=null semantics, invalidate at 16221 onward bounds demand frames. Canonical resources/jotai/docs/guides/using-store-outside-react.mdx supports shared external-store access. No standalone Three/R3F canonical checkout exists, so pinned installed sources govern those APIs.

### Startup loader review and attribution

- Canonical local references: resources/bun/docs/runtime/index.mdx (explicit Bun versus CLI shebang), runtime/environment-variables.mdx (env-file and inherited process values), resources/vite/docs/config/index.md and packages/vite/src/node/config.ts. Current official [Vite configuration documentation](https://vite.dev/config/) checked; installed Vite8.2.2 source governs differences from the older checkout.
- Installed config dispatch at node.js:36958 selects runnerImportConfigFile. runnerImport at36068 creates an isolated inline server environment with configFile/envDir disabled, tracks transformed relative dependencies and closes it in finally. Actual config is ESM/TypeScript; external packages remain externally resolved. The explicit Bun runtime and import.meta.dirname workspace-root credential-path normalization are unchanged; no env/cert contents were read.
- Independently probed temporary credential-free config: runner observes helper marker1→2 and main config marker3, reporting one dependency. Native was rejected: pinned Bun1.4/Vite native import returned cached helper1 with zero dependencies; engineer also proved main-config caching. No native-loader limitation is shipped.
- Initial live-restart probe failures were resolved by draining response bodies, Connection:close probes and waiting for CSS-triggered SSR navigation to settle before changing config. Final gate still requires actual changed headers, helper re-evaluation and T1 rendering within unchanged deadlines. No GPU attribution or unresolved production teardown claim is made.

### Suggestions (non-blocking)

- The final product review records the remaining visual limitations separately. Real mobile Safari GPU/frame profiling was not performed; no browser/device claim beyond the executed Chrome cases is implied.

### Neuve Dogfood Feedback

- Commands run: none; repository explicitly has no Neuve shell or board.
- Artifact refs: this review and tactile-collection-scope.md.
- Kanban updates: not applicable.
- HITL gate: none emitted.
- Signal value: not applicable.
- Sticking points: earlier reviewer could not be resumed due agent tool limit; lead assigned independent takeover without having the lead review its own implementation.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.
