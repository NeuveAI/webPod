# Responsive flick repair

## Authority and references

Read `tactile-collection-scope.md` and `AGENTS.md`. Applied Modern Web Guidance first using `bunx --bun`, Global Patterns, Interface Craft's storyboard, Interface Design Guardrails and all four resources, Neuve Motion principles/tokens/reduced-motion, Jotai State, and Web Interface Guidelines. Modern guidance's search returned low-relevance scroll animation suggestions, so the pointer-specific source is [W3C Pointer Events 3](https://www.w3.org/TR/pointerevents3/). Fresh [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) informed keyboard and reduced-motion checks. This is physical webPod orientation; no new UI component, dependency, or state root was added.

Canonical source inspected: `/Users/vinicius/code/.better-coding-agents/resources/jotai/docs/core/store.mdx`, for shared external-state ownership. Inspected installed `@react-three/fiber@9.7.0` event capture-map API and deferred lost-capture cleanup. `ViewerLitDeviceFrame.tsx` writes direct Three Euler rotation props, and `device-page.tsx` subscribes through `useSyncExternalStore`; there is no second visual smoothing layer. Existing native canvas listeners start only after a physical-shell raycast, preserving wheel, screen, and sticker isolation.

## Before-change reproduction

New `apps/web/src/device-flick-regression.test.ts` produced zero passes and five failures against the original source:

- A held slow drag from 0° to 100° stayed at 100°, leaving the device edge-on.
- A fast release after reaching 190° targeted 540°, adding a full revolution after crossing the rear.
- A short 20° flick at 300°/s coasted to 60°, leaving a hard speed cliff below 340°/s.
- Pointer movement 0→60→120→110 px over 60 ms still reported +1,500 px/s despite the fresh leftward reversal.
- Reduced-motion release at 100° stayed there instead of resolving to a useful face.

## Behavior and lifecycle changes

The named thresholds are 280°/s and at least 8° of travel in the latest directional impulse for an opposite-face flick. Direction-aware target selection avoids extra revolutions after overshooting the intended face. Slower releases project 120 ms of measured momentum, bounded to twice the latest impulse's travel, then spring toward the nearest 180° face. Arbitrary inspection angles remain available during drag and keyboard manipulation.

The analytic spring retains its 13/s natural frequency, 0.82 damping ratio, and 3.5° bounded overshoot. Pitch and roll retain decayed inertia. No frame-based interpolation was introduced.

Velocity restarts independently on each axis after a reversal. Identical pointer-up samples cannot refresh the last movement's age. Cancel and lost-capture paths release their own capture, discard velocity, and settle the nearest face. A failed new capture leaves existing settling intact. A successful re-grab starts from the currently published pose used by the renderer. Supported keyboard input ends active capture; unrelated keys preserve settling. External reset/tool orientation writes supersede pending gesture frames. Changing reduced-motion preference during release snaps the already-selected destination. Idle window blur preserves an intentionally chosen pose. Disposal unsubscribes and removes owned frames/listeners.

## Independent review corrections

The reviewer found that a tiny reverse movement could initially borrow total gesture travel, then found a second path through unrestricted momentum projection. The controller now explicitly passes signed recent-impulse travel into release admission, and ordinary projection obeys the same intent bound. Regression cases cover 1–4 px reversals at high apparent speed and deliberate 20/40 px reversals, asserting final destinations. The reviewer also caught the idle-blur pose change; the new idle-blur regression preserves oblique poses.

## Verification

Unit/source regression suites pass, including frame-rate independence, release-speed and distance behavior, stale samples, cancellation and lost capture separately, keyboard interruption, reduced-motion toggles, re-grab continuity, external reset, and failed capture. Scoped ESLint and `bun run --cwd apps/web typecheck` pass.

Browser validation uses the existing credential-free source snapshot and canonical `bun run dev`, visits the actual `/` product route, and sends real mouse and CDP touch events. The initial run passed seven of nine cases; two setup failures exceeded the historical five-second cold Canvas readiness timeout. The harness now allows a bounded twenty seconds for T1 and camera initialization. A later test sequence was corrected to avoid an instantaneous 100 px automation jump exceeding the production 5,000 px/s outlier guard; the gesture now moves through timed intermediate points.

The completed browser evidence is recorded below. Independent evidence approval remains pending; unit assertions alone do not establish subjective tactile quality.

## Browser handoff

The final full orientation run passed **11 tests in 1.9 minutes** on Chrome at 1280×900, with touch enabled. It served source fingerprint `5b2f2eba76d9fae91513195f4570621ad0ac68575263abb8f5632427ba758548` (370 source files). Command: `bunx --bun playwright test --config apps/web/tests/playwright.config.ts device-orientation.e2e.ts`.

A supplemental test then passed **one test in 18.2 seconds**, exercising native `releasePointerCapture`, its subsequent actual `lostpointercapture` event, nearest-face settling, and catching the moving physical top edge through the ordinary raycast. It asserts no pose jump while held and the exact 8.4° response to the next 20 px drag. Command: the same runner with `--grep 'native lost capture'`. Source fingerprint: `e7de5a150b171e278028cc79d29b1be3124f651c8a10a1ea676ed4e65c4533f8` (371 files). The first supplemental attempt waited before sending the next pointer event; the browser correctly deferred pending capture notification. The test now sends that event per Pointer Events semantics.

The updated test file contains twelve cases. The collection engineer added shared-surface files between these independent snapshots; final integrated collection validation must establish its own final source fingerprint. Both owned development servers and Chrome processes exited.

Visibly inspected screenshots:

- `evidence/tactile-flick/rear-after-short-flick.png`: the fully rendered rear after a short physical flick, with readable engraving and an emerging collection tab.
- `evidence/tactile-flick/front-after-repeated-flicks.png`: the fully rendered front after four alternating flips, reversal, reset and a wheel-centre click. The display shows the expected unavailable-library state because this isolated snapshot deliberately has no Apple signing credentials; token-service 503s are unrelated to orientation and were not suppressed.

Final unit/source command includes both device package orientation suites and all four app suites: **44 tests, 229 assertions**, saved to `evidence/tactile-flick/unit-results.log`. Scoped ESLint, app TypeScript, and `git diff --check` pass. Independent reviewer accepted the source corrections; final evidence approval remains with the lead/reviewer. Pack-opening/peeling while the device settles is an integrated collection check, not claimed by this unauthenticated orientation-only browser run.
