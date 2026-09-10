# Mobile tactility

Status: Ready for implementation; physical feel remains owner validation.

## Contract and sources

The owner's request is primary: render the device larger on phones, enlarge touch grab areas along its edges, and use web-haptics for clickwheel and sticker peeling, sticking, and interaction. The attached screenshot is visual evidence, not instructions. Branch: `codex/mobile-tactility`. No publish, merge, or push is requested.

Supporting sources: current `apps/web/src/device-page.tsx`, `packages/device/src/DeviceCanvas.tsx`, device orientation input, composite feedback, and sticker interaction lifecycle. These establish current contracts, not an immutable visual size. The canonical haptic source is `/Users/vinicius/code/.better-coding-agents/resources/web-haptics`; inspect its types and installed version before implementation. Repository AGENTS.md overrides generic skill process (no Kanban or neuve shell).

## Dispatch A: mobile framing and edge targets

Own device-page responsive framing, device canvas camera fitting, and device orientation grab input. Do not edit clickwheel, composite feedback, sticker interaction, or manifests. Aim for roughly 88–94% phone width where height allows, with complete device visibility and toolbar clearance at 320x568, 390x844, and landscape. Preserve desktop framing and explicit capture camera overrides. Increase touch edge hit tolerance toward a 44 CSS pixel band without stealing screen, clickwheel, or sticker gestures; keep mouse precision. Use canonical existing orientation and camera types.

Verification: existing camera/orientation tests, per-package typecheck, scoped eslint, and screenshots/touch checks on existing device routes. Record actual measured sizes and any tradeoff in `framing.md`; artifacts under `evidence/framing/`.

## Dispatch B: haptics

Own a shared haptics adapter/package if needed, manifests/lockfile, composite clickwheel feedback, and app sticker interaction call sites. Do not edit Dispatch A files; coordinate before any overlap. Use web-haptics canonical API with browser-safe lazy lifetime, cleanup, no debug audio, graceful unsupported behavior, and bounded/rate-limited feedback. Wheel detents and button presses should feel distinct; sticker pickup/peel/detachment/placement should follow admitted human interaction, not idle renders or background agent actions. Cancellation must stop ongoing feedback. Preserve audio settings semantics and existing state contracts; no useState.

Verification: existing clickwheel and sticker lifecycle tests, per-package typecheck, scoped eslint, and browser smoke for unsupported devices. Document physical-device feel as unverified. Record version/API evidence, decisions and results in `haptics.md`; artifacts under `evidence/haptics/`.

## Dependencies, decisions, and review

A and B run concurrently with disjoint ownership; independent review follows both. Routine reversible tuning is authorized by the request: log numerical choices and evidence in each diary. No security/auth/provider/storage changes. Never access cert contents or encrypted pen files. Bun/bunx only. Do not add unit tests (global instruction); run existing tests and use browser verification. No type escapes or lint disables to bypass checks. Document lifecycle and non-obvious exported helpers.

Reviewer reads this scope and both diaries, traces changed call chains, independently runs typecheck and lint, and checks touch routing, viewport clipping, haptic cancellation and unsupported-browser behavior. Review output: `review.md`. Evidence is automated behavior/static proof plus screenshots; actual tactile quality is human judgment and must not be claimed verified.

## Definition of done and history

- Larger phone framing with full shell and accessible controls, verified at listed sizes.
- Touch edge grabs work without taking existing control/sticker input.
- Web-haptics integrated for human wheel and sticker interaction, with cleanup and bounded feedback.
- Existing affected tests, typechecks and lint pass; independent review has no unresolved blocking findings.
- Diaries contain source/version research, autonomous decisions, commands, results and limitations.

Keep changes stageable as `Improve mobile device framing and touch edge grabs`, `Add tactile feedback to wheel and sticker gestures`, and documentation/evidence. Do not commit automatically. The supervisor reports results and remaining physical-phone validation to the owner.
