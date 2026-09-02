# Navigation and interaction re-review

## Verdict

**REQUEST_CHANGES**

Reviewed commits: `464c23c`, `ea23676`, `0881270`, `d89dd7a`,
`553f4eb`, `a0cd5da`, `778cf22`, `e3492ef`, and `a262f5f`.

Correction commit `e3492ef` closes all five original Major findings. One remaining
acceptance-level Major blocks approval. U14 phone-in-hand occlusion validation and
owner visual sign-off remain open and cannot be waived by this review.

## Prior finding disposition

1. **Fixture-only rendered boundary — CLOSED.** `PanelProps` now accepts a
   `MusicProvider` and `NavigationDataSource`; root seeding, selection, playback
   subscriptions, progress, rating, and volume all use the injected provider.
2. **Hard-coded/incomplete Search — CLOSED for the scoped track path.** S12 now
   has Jotai-backed text entry, queries library and catalogue, labels both result
   groups, and resolves catalogue-only results through `trackByKey`. The
   adversarial catalogue-only playback test passes.
3. **Unbranded navigation identity — CLOSED.** Entity routes, search result keys,
   and relationship methods now use provider-domain `LocalKey`.
4. **Label-driven routing — CLOSED.** Rows carry typed `destination` descriptors;
   the copy-mutation test proves display labels are no longer executable state.
5. **TypeScript gate failure — CLOSED.** The route-kind expectation is typed and
   the full gate reports 11/11 TypeScript projects clean.
6. **Behavior/evidence coverage — PARTIALLY CLOSED.** Existing state boundary and
   stack tests prove wheel silence and restoration; navigation tests now cover all
   root destinations, deep artist/playlist paths, typed copy-independent routing,
   unsupported Radio, empty relationships, and catalogue-only search playback.
   Provider-driven status transitions remain untested because they are not wired.
7. **Typed status routes — OPEN and promoted to Major below.** The correction did
   not connect provider session/capability state to the route stack.

## Blocking finding

### Major — provider-supported account/loading/permission states are not reachable typed frames

**File:** `packages/state/src/contract.ts:359-360`;
`packages/panel/src/Panel.tsx:88-106, 149-164, 320-334`

The dispatch requires loading, empty, error, signed-out, and playback-permission
postures to be reachable typed frames where the provider contract supports them.
The injected provider is used for data and playback, but `Panel` never reads or
subscribes to `provider.session`; instead these postures still come from the
caller-controlled `state` prop. The route union omits playback permission, and its
declared `status` state is not interpreted by `renderScreen`; only an async
selection rejection pushes S27, whose renderer ignores `route.state`. Consequently
a genuinely signed-out fixture/Apple provider still seeds and renders the ready
Music root until an operation happens to reject, and a signed-in-but-unable-to-play
session cannot drive a typed playback-permission frame. This leaves a required
provider-backed navigation path unreachable and makes the dispatch invariant
testimonial rather than true.

Connect the provider's supported session/loading/error/permission outcomes to a
closed typed frame/state transition, render from that typed state, and add tests
that start signed out and signed-in-without-playback and reach the correct frames
without manually setting `PanelProps.state`. Preserve D-019: offline is not a
provider capability and must not be reintroduced as one.

## Non-blocking follow-up

The browser evidence remains screenshot-plus-prose rather than a replayable input
trace. The deterministic coverage now carries substantially more of the behavior
proof, but the final evidence handoff should identify a reproducible interaction
script or trace for the canonical `/_spike/device` journeys.

## Verification performed

- Re-read the two correction commits and checked each previous finding against
  current source and tests.
- Targeted state navigation/boundary, panel navigation, and composite integration:
  **34 pass, 0 fail**.
- Per-package TypeScript for state, panel, and composite: clean.
- Repo lint: clean.
- `bun run gates`: **11/11 typechecks, lint clean, 1,145 tests pass, 16/16
  automated gates pass**.
- Unrelated dirty raster/device/token work was preserved. The uncommitted
  `Panel.tsx` raster multiplier is outside this review and was not modified.
- Repo-local Neuve/Kanban is intentionally unavailable by owner ruling; the
  workstream artifacts are the process source of truth.

